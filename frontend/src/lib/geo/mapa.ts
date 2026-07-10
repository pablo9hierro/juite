// Tiles do mapa — OpenStreetMap renderizado pela CARTO. Gratuito com
// atribuição obrigatória (já incluída no TILE_ATTR).
//
// "Dark Matter" (dark_all) em vez de "Voyager"/"Positron" — os estilos
// claros da CARTO desenham rua residencial num creme bem próximo do branco
// do resto do mapa (quase ilegível), e tentar consertar isso só com filtro
// CSS (invert+contrast) tem um problema real: o "auto dark theme" do
// Chrome no Android reprocessa cada tile (que é uma <img>) individualmente
// conforme ela entra na tela ao arrastar o mapa, e às vezes reaplica o
// PRÓPRIO escurecimento dele em cima do nosso filtro — resultado, o mapa
// pisca entre claro e escuro tile por tile durante o gesto. Um tile
// genuinamente escuro (feito assim pela CARTO, não invertido por CSS) não
// tem esse conflito: não sobra "fundo claro" pro heurístico do Chrome
// querer escurecer de novo.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'
export const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Centro usado quando o usuário nega o GPS (loja, José Américo de Almeida,
// João Pessoa - PB — mesma coordenada de sunset.shipping_settings).
export const FALLBACK = { lat: -7.1746, lng: -34.8576 }
