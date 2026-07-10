// Geocodificação com Nominatim (servidor público do OpenStreetMap).
// Gratuito, sem chave. Regra de ouro: máximo 1 requisição por segundo — por
// isso a busca no checkout usa debounce de 500ms. Portado de
// C:\Users\pablo\Documents\gliafico\src\backend\geocodificacao.js — detalhes
// e limites de uso documentados em src/backend/README.md daquele projeto.
import type { EnderecoResultado, Ponto } from './tipos'

// Texto → lista de endereços com coordenadas (autocomplete). `perto`
// (opcional) enviesa os resultados pra perto do usuário/loja.
export async function buscarEnderecos(q: string, perto?: Ponto): Promise<EnderecoResultado[]> {
  const p = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
  })
  if (perto) {
    p.set('viewbox', [perto.lng - 0.35, perto.lat - 0.35, perto.lng + 0.35, perto.lat + 0.35].join(','))
  }
  const r = await fetch('https://nominatim.openstreetmap.org/search?' + p)
  if (!r.ok) throw new Error('busca falhou')
  const hits = (await r.json()) as Array<{
    lat: string
    lon: string
    name?: string
    display_name: string
    address?: Record<string, string>
  }>
  return hits.map((hit) => {
    const a = hit.address || {}
    const rua = a.road || a.pedestrian || a.neighbourhood || hit.name || hit.display_name.split(',')[0]
    return {
      lat: +hit.lat,
      lng: +hit.lon,
      titulo: a.house_number ? `${rua}, ${a.house_number}` : rua,
      subtitulo: [a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state].filter(Boolean).join(' · '),
      bairro: a.suburb || a.neighbourhood,
    }
  })
}

// Coordenada → nome da rua (geocodificação reversa). Usada quando o usuário
// arrasta o alfinete. Nunca lança erro: devolve um fallback.
// zoom=18 pede o nível mais fino (rua/número) em vez do padrão do Nominatim,
// que às vezes devolve só o bairro/cidade pra coordenadas fora do centro.
// tentativa faz 1 retry silencioso — o reverse geocode falha às vezes só
// por rate limit (1 req/s do Nominatim) quando o usuário arrasta rápido.
export async function enderecoDe({ lat, lng }: Ponto, tentativa = 0): Promise<{ label: string; bairro?: string }> {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    'accept-language': 'pt-BR',
    zoom: '18',
  })
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?' + p)
    if (!r.ok) {
      if (tentativa < 1) {
        await new Promise((res) => setTimeout(res, 700))
        return enderecoDe({ lat, lng }, tentativa + 1)
      }
      return { label: 'Local no mapa' }
    }
    const body = (await r.json()) as { address?: Record<string, string>; display_name?: string }
    const a = body.address || {}
    const rua = a.road || a.pedestrian || a.suburb || a.neighbourhood || body.display_name?.split(',')[0]
    if (!rua) return { label: 'Local no mapa', bairro: a.suburb || a.neighbourhood }
    const label = a.house_number ? `${rua}, ${a.house_number}` : rua
    return { label, bairro: a.suburb || a.neighbourhood }
  } catch {
    if (tentativa < 1) {
      await new Promise((res) => setTimeout(res, 700))
      return enderecoDe({ lat, lng }, tentativa + 1)
    }
    return { label: 'Local no mapa' }
  }
}
