// Rotação manual do mapa (gesto de dois dedos — um fica parado, o outro
// gira em arco, tipo um compasso) e travamento de rotação num heading fixo
// (modo "GPS travado" do motoboy).
//
// Como isso não quebra o Leaflet: a rotação NUNCA toca em nada que o
// Leaflet gerencia (.leaflet-map-pane já tem um transform próprio pra
// pan/zoom — sobrescrever isso quebraria a posição dos tiles). Em vez
// disso, o componente que usa isso envolve a div do mapa numa div
// "giratória" maior que o contêiner visível (evita cantos vazios ao
// girar) e só essa div externa recebe transform: rotate(). Botões/
// controles do próprio app ficam FORA dela, como irmãos, então nunca
// giram. Markers dentro do mapa (Leaflet) giram junto automaticamente
// por herdarem o transform do pai — é assim que o ícone da moto acaba
// "apontando pra cima" sozinho quando o mapa trava no heading dele, sem
// precisar de nenhuma conta extra.

// Quanto a div giratória precisa ser maior que o contêiner visível pra
// não aparecer canto vazio ao girar em qualquer ângulo.
export const ROTATE_WRAPPER_OVERSCAN = '80%'

export interface GestoRotacaoOpcoes {
  onRotate: (deltaGraus: number) => void
}

function anguloEntre(t0: Touch, t1: Touch) {
  return (Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * 180) / Math.PI
}

// Roda em paralelo ao pinch-zoom nativo do Leaflet — não precisa desabilitar
// nada, girar é só um transform CSS por fora, não mexe no zoom/pan que o
// Leaflet já está fazendo com os mesmos dois dedos.
export function anexarGestoRotacao(el: HTMLElement, { onRotate }: GestoRotacaoOpcoes): () => void {
  let anguloAnterior: number | null = null

  function onTouchStart(e: TouchEvent) {
    anguloAnterior = e.touches.length === 2 ? anguloEntre(e.touches[0], e.touches[1]) : null
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length !== 2 || anguloAnterior == null) return
    const atual = anguloEntre(e.touches[0], e.touches[1])
    let delta = atual - anguloAnterior
    // normaliza o salto de -180/180 (evita um "pulo" de quase 360° quando
    // o ângulo cruza essa fronteira entre dois toques seguidos)
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    anguloAnterior = atual
    onRotate(delta)
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) anguloAnterior = null
  }

  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: true })
  el.addEventListener('touchend', onTouchEnd, { passive: true })
  el.addEventListener('touchcancel', onTouchEnd, { passive: true })

  return () => {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
  }
}

// Normaliza pra sempre ficar entre -180 e 180 — só cosmético, evita o
// número crescer sem limite depois de várias voltas.
export function normalizarAngulo(deg: number): number {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}
