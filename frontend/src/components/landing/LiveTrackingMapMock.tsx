import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TILE_URL, TILE_ATTR } from '../../lib/geo/mapa'
import { motoDivIcon, destDivIcon } from '../../lib/geo/icones'

// Mesma stack de mapa (tiles escuros da CARTO + ícones de moto/pino) já
// usada no dashboard do motoboy e em /consultar — travado (sem pan/zoom/
// gestos, é ilustrativo) e com o marcador de moto animado deslizando
// sozinho pela rota em loop. A rota é REAL de rua (buscada uma vez via
// calcularRota()/OSRM perto da loja e congelada aqui) — segue rua de
// verdade, não uma linha reta cortando quarteirão/calçada, e não faz
// nenhuma chamada de rede a cada visita da landing (o serviço público de
// rota é gratuito, não faz sentido bater nele de novo pra algo decorativo
// e sempre igual).
const ROTA: [number, number][] = [
  [-7.180796, -34.863348], [-7.180571, -34.86317], [-7.180435, -34.86309], [-7.180368, -34.863064],
  [-7.180239, -34.863047], [-7.180143, -34.863034], [-7.179698, -34.862984], [-7.179266, -34.862931],
  [-7.179363, -34.86221], [-7.178609, -34.862386], [-7.1785, -34.86251], [-7.178438, -34.862581],
  [-7.178329, -34.862643], [-7.178249, -34.862698], [-7.178185, -34.862753], [-7.178074, -34.862857],
  [-7.177894, -34.863034], [-7.177292, -34.863574], [-7.177184, -34.863653], [-7.177114, -34.863685],
  [-7.177023, -34.863708], [-7.176955, -34.863713], [-7.176877, -34.8637], [-7.176757, -34.863654],
  [-7.176661, -34.863605], [-7.176541, -34.863539], [-7.176457, -34.863479], [-7.176393, -34.863421],
  [-7.176345, -34.86337], [-7.176289, -34.863281], [-7.176209, -34.863119], [-7.176047, -34.862799],
  [-7.175882, -34.862482], [-7.175828, -34.862375], [-7.175716, -34.862167], [-7.175615, -34.861961],
  [-7.175557, -34.861846], [-7.1754, -34.861522], [-7.175247, -34.861216], [-7.175203, -34.861078],
  [-7.175184, -34.861021], [-7.175154, -34.860973], [-7.174894, -34.860672], [-7.174585, -34.860339],
  [-7.174278, -34.859999], [-7.174148, -34.860112], [-7.17382, -34.859715], [-7.173448, -34.859284],
  [-7.173057, -34.85881], [-7.174267, -34.85782], [-7.174283, -34.857842],
]

// Um loop completo demora isso (bem devagar de propósito — é decorativo,
// não uma corrida de verdade).
const LOOP_DURATION_MS = 17000

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
    })

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 20 }).addTo(map)
    const line = L.polyline(ROTA, { color: '#e08a3a', weight: 3, opacity: 0.55, dashArray: '1 8', lineCap: 'round' }).addTo(map)
    map.fitBounds(line.getBounds(), { padding: [6, 6] })
    L.marker(ROTA[ROTA.length - 1], { icon: destDivIcon(20) }).addTo(map)
    const motoMarker = L.marker(ROTA[0], { icon: motoDivIcon(0, 24) }).addTo(map)

    // Distância acumulada em cada ponto da rota — anda em velocidade
    // constante (não "acelera" nos trechos com pontos mais espaçados),
    // interpolando por distância percorrida, não por índice do array.
    const dists = [0]
    for (let i = 1; i < ROTA.length; i++) {
      dists.push(dists[i - 1] + L.latLng(ROTA[i - 1]).distanceTo(L.latLng(ROTA[i])))
    }
    const total = dists[dists.length - 1] || 1

    let animId: number
    const start = performance.now()
    function animate(now: number) {
      const t = ((now - start) % LOOP_DURATION_MS) / LOOP_DURATION_MS
      const targetDist = t * total
      let seg = 0
      while (seg < dists.length - 2 && dists[seg + 1] < targetDist) seg++
      const segLen = dists[seg + 1] - dists[seg] || 1
      const localT = (targetDist - dists[seg]) / segLen
      const [lat1, lng1] = ROTA[seg]
      const [lat2, lng2] = ROTA[seg + 1]
      motoMarker.setLatLng([lat1 + (lat2 - lat1) * localT, lng1 + (lng2 - lng1) * localT])
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      map.remove()
    }
  }, [])

  return <div ref={divRef} className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-white/10" />
}
