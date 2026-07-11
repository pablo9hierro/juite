use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;

use crate::abacatepay;
use crate::error::AppError;
use crate::google_routes::{self, Ponto, RotaResult};
use crate::models::OrderDto;
use crate::orders_common::{fetch_items, fetch_order_dto, fetch_order_row, row_to_dto, short_id};
use crate::state::AppState;
use crate::whatsapp;

// Catálogo, criação/consulta de pedido etc. foram todos migrados pra RPCs do
// Supabase (ver supabase/*.sql) — só sobra aqui o que precisa de segredo
// (Pix, WhatsApp), que só existe no backend Rust.

#[derive(Debug, Deserialize)]
pub struct NotifyOrderCreatedInput {
    pub order_id: String,
}

/// Público de propósito — dispara logo depois do checkout, antes do cliente
/// ter qualquer sessão/token. O texto é montado aqui a partir do pedido
/// (nunca confia em texto vindo do cliente), então o único jeito de abusar
/// disso é reenviar a mesma mensagem fixa pro próprio cliente do pedido,
/// o que é inofensivo.
pub async fn notify_order_created(
    State(state): State<AppState>,
    Json(input): Json<NotifyOrderCreatedInput>,
) -> Result<StatusCode, AppError> {
    let Some(order) = fetch_order_row(&state.pool, &input.order_id).await? else {
        return Err(AppError::NotFound("order not found".to_string()));
    };
    let digits = whatsapp::digits_only(&order.customer_whatsapp);
    let msg = format!(
        "Olá, {}! Recebemos seu pedido e já estamos preparando 😋 Assim que ficar pronto, avisamos por aqui!",
        order.customer_name
    );
    whatsapp::notify(&state, &state.evolution_instance, &digits, &msg);
    Ok(StatusCode::NO_CONTENT)
}

/// Cria a cobrança Pix de verdade na AbacatePay (ou fake em modo mock) pro
/// pedido — antes disso não existia nenhum lugar que de fato chamava a API
/// de pagamento; a tela de pagamento só lia campos que nunca eram
/// preenchidos. Idempotente: se já tiver cobrança criada, devolve como está
/// em vez de criar uma segunda.
pub async fn create_pix_payment(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OrderDto>, AppError> {
    let Some(order) = fetch_order_row(&state.pool, &id).await? else {
        return Err(AppError::NotFound("order not found".to_string()));
    };

    if order.payment_method != "pix" {
        return Err(AppError::BadRequest("order is not a pix payment".to_string()));
    }
    if order.pix_payment_id.is_some() {
        return Ok(Json(row_to_dto(&state.pool, order).await?));
    }

    let digits = whatsapp::digits_only(&order.customer_whatsapp);
    let pix = abacatepay::create_pix_charge(&state, order.total, &order.customer_name, &digits).await?;

    sqlx::query(
        "UPDATE orders SET pix_payment_id = $1, pix_qr_base64 = $2, pix_copia_cola = $3, updated_at = now()::text WHERE id = $4",
    )
    .bind(&pix.payment_id)
    .bind(&pix.qr_code_base64)
    .bind(&pix.qr_code)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let dto = fetch_order_dto(&state.pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("order not found".to_string()))?;
    Ok(Json(dto))
}

#[derive(Debug, Deserialize)]
pub struct ComputeRouteInput {
    pub de: Ponto,
    pub ate: Ponto,
}

/// Sem chave nenhuma no navegador: o frontend manda dois pontos, a gente
/// decide (Google Routes ou OSRM) e devolve o trajeto pronto. Usado pela
/// navegação do motoboy e pelo acompanhamento do cliente em /consultar.
pub async fn compute_route(
    State(state): State<AppState>,
    Json(input): Json<ComputeRouteInput>,
) -> Result<Json<RotaResult>, AppError> {
    let rota = google_routes::calcular_rota(&state, input.de, input.ate).await?;
    Ok(Json(rota))
}

#[derive(Debug, Deserialize)]
pub struct NotifyPdvSaleInput {
    pub order_id: String,
}

/// Venda de balcão (PDV) só manda UMA mensagem — o "obrigado pela compra"
/// com os itens e o valor — nunca o passo a passo (pedido feito/pronto/
/// saiu pra entrega) que uma compra online recebe, porque não existe
/// preparo nem entrega aqui, a venda já nasce concluída. Sempre a partir
/// do número da PRÓPRIA LOJA (vendedor não tem instância de WhatsApp
/// própria, diferente do motoboy). Sem WhatsApp informado na venda
/// (cliente de balcão anônimo), não faz nada — sucesso silencioso.
pub async fn notify_pdv_sale(
    State(state): State<AppState>,
    Json(input): Json<NotifyPdvSaleInput>,
) -> Result<StatusCode, AppError> {
    let Some(order) = fetch_order_row(&state.pool, &input.order_id).await? else {
        return Err(AppError::NotFound("order not found".to_string()));
    };

    let digits = whatsapp::digits_only(&order.customer_whatsapp);
    if digits.is_empty() {
        return Ok(StatusCode::NO_CONTENT);
    }

    let items = fetch_items(&state.pool, &order.id).await?;
    let itens_texto = items
        .iter()
        .map(|i| format!("{}x {}", i.quantity, i.product_name))
        .collect::<Vec<_>>()
        .join("\n");

    let total_str = format!("{:.2}", order.total).replace('.', ",");
    let msg = format!("Obrigado pela compra na Sunset Tabas! 🌇\n\n{itens_texto}\n\nTotal: R$ {total_str}");

    whatsapp::notify(&state, &state.evolution_instance, &digits, &msg);
    Ok(StatusCode::NO_CONTENT)
}

pub async fn refresh_payment(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OrderDto>, AppError> {
    let Some(order) = fetch_order_row(&state.pool, &id).await? else {
        return Err(AppError::NotFound("order not found".to_string()));
    };

    if order.payment_method != "pix" || order.payment_status == "pago" {
        return Ok(Json(row_to_dto(&state.pool, order).await?));
    }

    let (Some(payment_id), true) = (order.pix_payment_id.clone(), state.abacatepay_key.is_some()) else {
        // Mock mode (or no payment id yet): nothing to check against the real API.
        return Ok(Json(row_to_dto(&state.pool, order).await?));
    };

    let status = abacatepay::get_charge_status(&state, &payment_id).await?;
    if status == "PAID" {
        sqlx::query("UPDATE orders SET payment_status = 'pago', updated_at = now()::text WHERE id = $1")
            .bind(&id)
            .execute(&state.pool)
            .await?;

        let digits = whatsapp::digits_only(&order.customer_whatsapp);
        let msg = format!(
            "Recebemos seu pagamento! Seu pedido #{} já está sendo preparado. 🌇",
            short_id(&order.id)
        );
        whatsapp::notify(&state, &state.evolution_instance, &digits, &msg);
    }

    let dto = fetch_order_dto(&state.pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("order not found".to_string()))?;
    Ok(Json(dto))
}

pub async fn simulate_pix_paid(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OrderDto>, AppError> {
    if state.abacatepay_key.is_some() {
        return Err(AppError::Forbidden(
            "a real ABACATEPAY_API_KEY is configured; simulate-pix-paid is disabled".to_string(),
        ));
    }

    let Some(order) = fetch_order_row(&state.pool, &id).await? else {
        return Err(AppError::NotFound("order not found".to_string()));
    };
    if order.payment_method != "pix" {
        return Err(AppError::BadRequest("order is not a pix payment".to_string()));
    }

    if order.payment_status != "pago" {
        sqlx::query("UPDATE orders SET payment_status = 'pago', updated_at = now()::text WHERE id = $1")
            .bind(&id)
            .execute(&state.pool)
            .await?;

        let digits = whatsapp::digits_only(&order.customer_whatsapp);
        let msg = format!(
            "Recebemos seu pagamento! Seu pedido #{} já está sendo preparado. 🌇",
            short_id(&order.id)
        );
        whatsapp::notify(&state, &state.evolution_instance, &digits, &msg);
    }

    let dto = fetch_order_dto(&state.pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("order not found".to_string()))?;
    Ok(Json(dto))
}
