// Tiles do mapa — OpenStreetMap renderizado pela CARTO (visual claro).
// Gratuito com atribuição obrigatória (já incluída no TILE_ATTR). Portado
// de C:\Users\pablo\Documents\gliafico\src\backend\mapa.js
//
// "Voyager" em vez de "Positron" (light_all) — a Positron é tão minimalista
// que as ruas ficam quase invisíveis (cinza claríssimo sobre branco);
// Voyager mantém o visual claro mas com ruas/rótulos bem mais legíveis.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
export const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Centro usado quando o usuário nega o GPS (loja, José Américo de Almeida,
// João Pessoa - PB — mesma coordenada de sunset.shipping_settings).
export const FALLBACK = { lat: -7.1746, lng: -34.8576 }
