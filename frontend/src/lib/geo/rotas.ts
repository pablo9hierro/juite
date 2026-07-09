// Rotas pelas ruas com OSRM (servidor demo do projeto OSRM). Gratuito, sem
// chave, sem cota oficial — mas é servidor de demonstração, sem garantia de
// uptime. Portado de C:\Users\pablo\Documents\gliafico\src\backend\rotas.js
import type { Ponto, Rota } from './tipos'

// Distância em LINHA RETA entre dois pontos (fórmula de Haversine). Zero
// requisição — é só matemática, funciona offline. Mesma fórmula usada no
// banco (sunset._distance_km) pra recalcular o frete de verdade no pedido —
// esta função aqui é só pra estimativa ao vivo no checkout.
export function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Rota real pelas ruas — usada pra desenhar o trajeto no mapa e mostrar
// km/min. NÃO usada pro cálculo do frete (esse usa linha reta, mais barato
// e mais estável que depender do servidor demo do OSRM).
export async function calcularRota(de: Ponto, ate: Ponto): Promise<Rota> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${de.lng},${de.lat};${ate.lng},${ate.lat}?overview=full&geometries=geojson`
  const r = await fetch(url)
  if (!r.ok) throw new Error('rota falhou')
  const body = (await r.json()) as { routes?: Array<{ geometry: { coordinates: [number, number][] }; distance: number; duration: number }> }
  const rota = body.routes?.[0]
  if (!rota) throw new Error('sem rota')
  return {
    coords: rota.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    km: rota.distance / 1000,
    min: Math.max(1, Math.round(rota.duration / 60)),
  }
}
