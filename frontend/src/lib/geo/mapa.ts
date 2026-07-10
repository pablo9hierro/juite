import type L from 'leaflet'

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

// Diagnóstico: em vez de ficar advinhando por que os tiles não aparecem
// (pode ser contraste, pode ser a CDN da CARTO falhando/lenta numa rede
// específica — são bugs completamente diferentes e parecem iguais na
// tela), isso avisa de verdade quando os tiles estão de fato falhando em
// carregar (rede/CDN), separando isso de "carregou mas tá difícil de ver".
export function monitorarTiles(layer: L.TileLayer, onMudarStatus: (falhando: boolean) => void): () => void {
  let falhasSeguidas = 0
  const onErro = () => {
    falhasSeguidas++
    if (falhasSeguidas >= 3) onMudarStatus(true)
  }
  const onCarregou = () => {
    falhasSeguidas = 0
    onMudarStatus(false)
  }
  layer.on('tileerror', onErro)
  layer.on('tileload', onCarregou)
  return () => {
    layer.off('tileerror', onErro)
    layer.off('tileload', onCarregou)
  }
}
