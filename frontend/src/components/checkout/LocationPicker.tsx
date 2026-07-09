import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ArrowLeft, Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { buscarEnderecos, enderecoDe } from '../../lib/geo/geocodificacao'
import { obterLocalizacao } from '../../lib/geo/localizacao'
import { FALLBACK, TILE_ATTR, TILE_URL } from '../../lib/geo/mapa'
import type { EnderecoResultado, Ponto } from '../../lib/geo/tipos'
import { api } from '../../lib/api'
import type { ShippingEstimate } from '../../lib/types'

export interface LocationPickerResult {
  lat: number
  lng: number
  label: string
  bairro?: string
  estimate?: ShippingEstimate
}

interface LocationPickerProps {
  initial?: (Ponto & { label?: string; bairro?: string }) | null
  onClose: () => void
  onConfirm: (result: LocationPickerResult) => void
}

// Mapa "cru" (sem React-Leaflet): o pino fica fixo no centro da TELA via CSS
// e é o MAPA que desliza por baixo dele (mesmo truque do Uber/99). Remonta
// via `key` no componente pai sempre que o centro inicial muda de vez
// (busca/GPS) — arrastos normais não remontam, só disparam moveend.
function MapaCentro({
  centro,
  zoom = 17,
  onMoveStart,
  onMoveEnd,
}: {
  centro: Ponto
  zoom?: number
  onMoveStart?: () => void
  onMoveEnd?: (c: Ponto) => void
}) {
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!divRef.current) return
    const map = L.map(divRef.current, { zoomControl: false }).setView([centro.lat, centro.lng], zoom)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 20 }).addTo(map)
    if (onMoveStart) map.on('movestart', onMoveStart)
    if (onMoveEnd) map.on('moveend', () => onMoveEnd(map.getCenter()))
    return () => {
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={divRef} className="absolute inset-0" />
}

export default function LocationPicker({ initial, onClose, onConfirm }: LocationPickerProps) {
  const [step, setStep] = useState<'busca' | 'ajuste'>(initial ? 'ajuste' : 'busca')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EnderecoResultado[]>([])
  const [searching, setSearching] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [ajusteCentro, setAjusteCentro] = useState<Ponto>(initial ?? FALLBACK)
  const [pos, setPos] = useState<Ponto>(initial ?? FALLBACK)
  const [label, setLabel] = useState(initial?.label ?? 'Localizando…')
  const [bairro, setBairro] = useState<string | undefined>(initial?.bairro)
  const [moving, setMoving] = useState(false)
  const [estimate, setEstimate] = useState<ShippingEstimate | null>(null)
  const [confirming, setConfirming] = useState(false)

  const seq = useRef(0)

  // Debounce de 500ms na busca — Nominatim só aceita 1 requisição/segundo.
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([])
      setSearching(false)
      return
    }
    const id = ++seq.current
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await buscarEnderecos(query, pos)
        if (id === seq.current) setResults(r)
      } catch {
        if (id === seq.current) setResults([])
      }
      if (id === seq.current) setSearching(false)
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Roda uma vez ao entrar (ou reentrar) na tela de ajuste — a construção
  // do mapa não dispara "moveend" sozinha, então o primeiro endereço/frete
  // precisa ser buscado manualmente aqui.
  useEffect(() => {
    if (step !== 'ajuste') return
    let cancelled = false
    ;(async () => {
      const addr = await enderecoDe(ajusteCentro)
      if (!cancelled) {
        setLabel(addr.label)
        setBairro(addr.bairro)
      }
      try {
        const est = await api.estimateShipping(ajusteCentro.lat, ajusteCentro.lng)
        if (!cancelled) setEstimate(est)
      } catch {
        if (!cancelled) setEstimate(null)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ajusteCentro])

  function abrirAjuste(centro: Ponto, addr?: { label?: string; bairro?: string }) {
    setAjusteCentro(centro)
    setPos(centro)
    setLabel(addr?.label ?? 'Localizando…')
    setBairro(addr?.bairro)
    setStep('ajuste')
  }

  async function usarLocalizacaoAtual() {
    setErrorMsg(null)
    setGpsLoading(true)
    try {
      const p = await obterLocalizacao()
      abrirAjuste(p)
    } catch {
      setErrorMsg('Não consegui acessar seu GPS. Ajuste o alfinete manualmente no mapa.')
      abrirAjuste(pos)
    } finally {
      setGpsLoading(false)
    }
  }

  async function handleMoveEnd(c: Ponto) {
    setPos(c)
    setMoving(false)
    setLabel('…')
    const [addr, est] = await Promise.allSettled([enderecoDe(c), api.estimateShipping(c.lat, c.lng)])
    if (addr.status === 'fulfilled') {
      setLabel(addr.value.label)
      setBairro(addr.value.bairro)
    }
    setEstimate(est.status === 'fulfilled' ? est.value : null)
  }

  async function confirmar() {
    setConfirming(true)
    try {
      onConfirm({ lat: pos.lat, lng: pos.lng, label, bairro, estimate: estimate ?? undefined })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-son-black flex flex-col">
      {step === 'busca' && (
        <>
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
            <Search className="w-4 h-4 text-son-silver-dim flex-none" />
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-white placeholder-son-silver-dim text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite sua rua e número..."
            />
            <button onClick={onClose} className="text-son-silver-dim hover:text-white flex-none" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <button
              type="button"
              onClick={usarLocalizacaoAtual}
              disabled={gpsLoading}
              className="w-full flex items-center gap-3 px-4 py-4 border-b border-white/5 text-left hover:bg-white/5 transition-colors"
            >
              {gpsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-son-pink flex-none" />
              ) : (
                <LocateFixed className="w-4 h-4 text-son-pink flex-none" />
              )}
              <div>
                <div className="text-sm font-medium text-white">Usar minha localização atual</div>
                <div className="text-xs text-son-silver-dim">Depois dá pra ajustar o alfinete no mapa</div>
              </div>
            </button>

            {errorMsg && <p className="error-msg px-4 pt-3">{errorMsg}</p>}

            {searching && <p className="text-xs text-son-silver-dim px-4 py-3">Buscando endereços…</p>}
            {!searching && query.trim().length >= 3 && results.length === 0 && (
              <p className="text-xs text-son-silver-dim px-4 py-3">Nenhum endereço encontrado. Tente incluir o bairro.</p>
            )}
            {!searching && query.trim().length > 0 && query.trim().length < 3 && (
              <p className="text-xs text-son-silver-dim px-4 py-3">Digite pelo menos 3 letras do endereço…</p>
            )}

            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => abrirAjuste(r, { label: r.titulo, bairro: r.bairro })}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 text-left hover:bg-white/5 transition-colors"
              >
                <MapPin className="w-4 h-4 text-son-silver-dim flex-none" />
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{r.titulo}</div>
                  <div className="text-xs text-son-silver-dim truncate">{r.subtitulo}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'ajuste' && (
        <>
          <div className="relative flex-1">
            <MapaCentro
              key={`${ajusteCentro.lat.toFixed(5)},${ajusteCentro.lng.toFixed(5)}`}
              centro={ajusteCentro}
              onMoveStart={() => setMoving(true)}
              onMoveEnd={handleMoveEnd}
            />

            <button
              onClick={() => setStep('busca')}
              className="absolute top-4 left-4 z-[500] w-10 h-10 flex items-center justify-center rounded-full bg-son-black/80 border border-white/10 text-white backdrop-blur-sm"
              aria-label="Voltar pra busca"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-[500] w-10 h-10 flex items-center justify-center rounded-full bg-son-black/80 border border-white/10 text-white backdrop-blur-sm"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-[400]">
              <div
                className={`glass rounded-xl px-3 py-1.5 mb-1 max-w-[85vw] text-xs font-medium text-white transition-opacity ${
                  moving ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {label}
              </div>
              <MapPin
                className={`w-9 h-9 text-son-pink drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] transition-transform ${
                  moving ? '-translate-y-2' : 'translate-y-0'
                }`}
                fill="currentColor"
              />
              <div className={`w-2 h-1 rounded-full bg-black/40 -mt-1 transition-opacity ${moving ? 'opacity-30' : 'opacity-60'}`} />
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-white">
              <MapPin className="w-4 h-4 text-son-pink flex-none" />
              <span className="truncate">{label}</span>
            </div>
            {estimate && (
              <p className="text-xs text-son-silver-dim">
                {estimate.km.toFixed(1).replace('.', ',')} km da loja · Frete estimado: R${' '}
                {estimate.price.toFixed(2).replace('.', ',')}
              </p>
            )}
            <button onClick={confirmar} disabled={confirming || moving} className="btn-primary w-full py-3.5">
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmar localização
            </button>
          </div>
        </>
      )}
    </div>
  )
}
