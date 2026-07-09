// Manipulação manual do mapa (arrastar, pinçar pra zoom, girar com dois
// dedos) quando o mapa pode estar rotacionado.
//
// Por que isso não pode usar o dragging/touchZoom nativos do Leaflet: a
// gente gira o mapa aplicando transform: rotate() numa div POR FORA de
// tudo que o Leaflet controla (é a única forma segura de girar sem
// sobrescrever o transform que o próprio Leaflet usa pra posicionar os
// tiles). Só que o dragging/touchZoom nativos calculam o deslocamento em
// pixels de TELA e aplicam direto nas coordenadas internas do mapa, sem
// noção nenhuma de que aquilo está visualmente girado — resultado: assim
// que o mapa gira uma vez, arrastar/pinçar depois passa a se comportar de
// forma errada (ex.: parece que um dedo ficou "preso"), porque o Leaflet
// está computando tudo no referencial ERRADO.
//
// A solução correta é desligar o dragging/touchZoom/scrollWheelZoom
// nativos nesses mapas e reimplementar arrastar+pinçar+girar como UM gesto
// só, que sempre leva a rotação atual em conta ao converter "quanto o dedo
// moveu na tela" pra "quanto o mapa deve se mover de verdade".

export interface GestoMapaOpcoes {
  map: L.Map
  // Sempre lida o ângulo mais atual (não captura um valor antigo preso no
  // fechamento da função).
  getRotation: () => number
  onRotate: (anguloGraus: number) => void
  // Enquanto false, o gesto não mexe no mapa (ex.: modo travado do
  // motoboy, onde é o app que manda na posição/zoom/rotação).
  enabled?: () => boolean
  // Chamado assim que o usuário de fato arrasta/pinça/gira algo — útil pra
  // quem quer saber "o usuário mexeu no mapa na mão" sem depender dos
  // eventos dragstart/zoomstart nativos do Leaflet (que não disparam mais,
  // já que o dragging/touchZoom nativos ficam desligados nesses mapas).
  onInteract?: () => void
}

interface PontoTela {
  x: number
  y: number
}

function centroide(a: PontoTela, b: PontoTela): PontoTela {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
function distancia(a: PontoTela, b: PontoTela): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function anguloEntre(a: PontoTela, b: PontoTela): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}
function deTouch(t: Touch): PontoTela {
  return { x: t.clientX, y: t.clientY }
}

// Roda um vetor de deslocamento de tela (dx,dy) pelo inverso da rotação
// atual — converte "quanto moveu na tela" pra "quanto precisa mover no
// referencial sem-rotação que o Leaflet entende".
function rotacionarVetor(dx: number, dy: number, anguloGraus: number): [number, number] {
  const rad = (-anguloGraus * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [dx * cos - dy * sin, dx * sin + dy * cos]
}

export function anexarGestoMapa(el: HTMLElement, opcoes: GestoMapaOpcoes): () => void {
  const { map, getRotation, onRotate } = opcoes
  const enabled = opcoes.enabled ?? (() => true)
  const onInteract = opcoes.onInteract ?? (() => {})

  let ultimoMeio: PontoTela | null = null
  let ultimaDistancia: number | null = null
  let ultimoAngulo: number | null = null

  function pan(dxTela: number, dyTela: number) {
    const [dx, dy] = rotacionarVetor(dxTela, dyTela, getRotation())
    // Arrasta o "papel" na direção do dedo — o centro do mapa anda pro
    // lado oposto do deslocamento do dedo.
    map.panBy([-dx, -dy], { animate: false })
  }

  function onTouchStart(e: TouchEvent) {
    if (!enabled()) return
    if (e.touches.length === 1) {
      ultimoMeio = deTouch(e.touches[0])
      ultimaDistancia = null
      ultimoAngulo = null
    } else if (e.touches.length === 2) {
      const p0 = deTouch(e.touches[0])
      const p1 = deTouch(e.touches[1])
      ultimoMeio = centroide(p0, p1)
      ultimaDistancia = distancia(p0, p1)
      ultimoAngulo = anguloEntre(p0, p1)
    } else {
      ultimoMeio = null
      ultimaDistancia = null
      ultimoAngulo = null
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!enabled()) return
    if (e.touches.length === 1 && ultimoMeio) {
      e.preventDefault()
      const p = deTouch(e.touches[0])
      pan(p.x - ultimoMeio.x, p.y - ultimoMeio.y)
      ultimoMeio = p
      onInteract()
      return
    }

    if (e.touches.length === 2) {
      e.preventDefault()
      onInteract()
      const p0 = deTouch(e.touches[0])
      const p1 = deTouch(e.touches[1])
      const meio = centroide(p0, p1)
      const dist = distancia(p0, p1)
      const ang = anguloEntre(p0, p1)

      if (ultimoMeio) pan(meio.x - ultimoMeio.x, meio.y - ultimoMeio.y)

      if (ultimaDistancia != null && ultimaDistancia > 0) {
        const fator = dist / ultimaDistancia
        if (Number.isFinite(fator) && fator > 0) {
          map.setZoom(map.getZoom() + Math.log2(fator), { animate: false })
        }
      }

      if (ultimoAngulo != null) {
        let delta = ang - ultimoAngulo
        if (delta > 180) delta -= 360
        if (delta < -180) delta += 360
        onRotate(normalizarAngulo(getRotation() + delta))
      }

      ultimoMeio = meio
      ultimaDistancia = dist
      ultimoAngulo = ang
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length === 0) {
      ultimoMeio = null
      ultimaDistancia = null
      ultimoAngulo = null
    } else if (e.touches.length === 1) {
      ultimoMeio = deTouch(e.touches[0])
      ultimaDistancia = null
      ultimoAngulo = null
    }
  }

  // Mouse (desktop): arrastar com o botão pressionado + roda pra zoom.
  // Sem gesto de girar no mouse (não existe "dois dedos" nele).
  let arrastandoComMouse = false
  let ultimoMouse: PontoTela | null = null

  function onMouseDown(e: MouseEvent) {
    if (!enabled() || e.button !== 0) return
    arrastandoComMouse = true
    ultimoMouse = { x: e.clientX, y: e.clientY }
  }
  function onMouseMove(e: MouseEvent) {
    if (!enabled() || !arrastandoComMouse || !ultimoMouse) return
    const p = { x: e.clientX, y: e.clientY }
    pan(p.x - ultimoMouse.x, p.y - ultimoMouse.y)
    ultimoMouse = p
    onInteract()
  }
  function onMouseUp() {
    arrastandoComMouse = false
    ultimoMouse = null
  }
  function onWheel(e: WheelEvent) {
    if (!enabled()) return
    e.preventDefault()
    map.setZoom(map.getZoom() - Math.sign(e.deltaY) * 0.5, { animate: false })
    onInteract()
  }

  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEnd, { passive: true })
  el.addEventListener('touchcancel', onTouchEnd, { passive: true })
  el.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  el.addEventListener('wheel', onWheel, { passive: false })

  return () => {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
    el.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    el.removeEventListener('wheel', onWheel)
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
