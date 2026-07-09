use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;

use crate::error::AppError;
use crate::mercadopago;
use crate::models::OrderDto;
use crate::orders_common::{fetch_order_dto, fetch_order_row, row_to_dto, short_id};
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

    let (Some(payment_id), true) = (order.pix_payment_id.clone(), state.mp_token.is_some()) else {
        // Mock mode (or no payment id yet): nothing to check against the real API.
        return Ok(Json(row_to_dto(&state.pool, order).await?));
    };

    let status = mercadopago::get_payment_status(&state, &payment_id).await?;
    if status == "approved" {
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
    if state.mp_token.is_some() {
        return Err(AppError::Forbidden(
            "a real MP_ACCESS_TOKEN is configured; simulate-pix-paid is disabled".to_string(),
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
