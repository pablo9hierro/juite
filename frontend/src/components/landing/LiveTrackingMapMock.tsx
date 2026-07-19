import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TILE_URL, TILE_ATTR, FALLBACK } from '../../lib/geo/mapa'
import { motoDivIcon, destDivIcon } from '../../lib/geo/icones'

// Mesma stack de mapa (tiles escuros da CARTO + ícones de moto/pino) já
// usada no dashboard do motoboy e em /consultar — só que travado (sem
// pan/zoom/gestos, é ilustrativo) e com o marcador de moto animado
// deslizando sozinho pela rota em loop, pra dar vida ao card sem depender
// de nenhum pedido de verdade.
const ROTA: [number, number][] = [
  [FALLBACK.lat - 0.006, FALLBACK.lng - 0.007],
  [FALLBACK.lat - 0.003, FALLBACK.lng - 0.004],
  [FALLBACK.lat - 0.0015, FALLBACK.lng - 0.0015],
  [FALLBACK.lat, FALLBACK.lng],
]

export default function LiveTrackingMapMock() {
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!divRef.current) return
    const map = L.map(divRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false,
    }).setView(ROTA[1], 15)

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 20 }).addTo(map)
    L.polyline(ROTA, { color: '#e08a3a', weight: 3, opacity: 0.55, dashArray: '1 8', lineCap: 'round' }).addTo(map)
    L.marker(ROTA[ROTA.length - 1], { icon: destDivIcon(20) }).addTo(map)
    const motoMarker = L.marker(ROTA[0], { icon: motoDivIcon(0, 24) }).addTo(map)

    const TOTAL_FRAMES = 260
    let frame = 0
    let animId: number

    function animate() {
      const segCount = ROTA.length - 1
      const t = ((frame % TOTAL_FRAMES) / TOTAL_FRAMES) * segCount
      const seg = Math.min(Math.floor(t), segCount - 1)
      const localT = t - seg
      const [lat1, lng1] = ROTA[seg]
      const [lat2, lng2] = ROTA[seg + 1]
      motoMarker.setLatLng([lat1 + (lat2 - lat1) * localT, lng1 + (lng2 - lng1) * localT])
      frame++
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      map.remove()
    }
  }, [])

  return <div ref={divRef} className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden border border-white/10" />
}
