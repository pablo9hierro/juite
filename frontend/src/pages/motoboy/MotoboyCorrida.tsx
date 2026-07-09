import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { animate, motion, useMotionValue } from 'framer-motion'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Check, ChevronsRight, Copy, ExternalLink, Loader2, LocateFixed, MapPin, PackageCheck } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { seguirLocalizacao } from '../../lib/geo/localizacao'
import { calcularRota, distanciaKm } from '../../lib/geo/rotas'
import { FALLBACK, TILE_ATTR, TILE_URL } from '../../lib/geo/mapa'
import { destDivIcon, motoDivIcon } from '../../lib/geo/icones'
import type { Ponto, Rota } from '../../lib/geo/tipos'
import type { MotoboyRun } from '../../lib/types'

const ARRIVAL_RADIUS_KM = 0.08 // ~80m — dá pra considerar "chegou"
const POSITION_UPDATE_MIN_MS = 4000
const ROUTE_REFRESH_MS = 25000

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

// Arraste até o fim pra concluir a entrega — só "destrava" de verdade
// depois que o pai confirma (pagamento, se precisar); se não confirmar,
// volta pro início sozinho.
function SwipeToComplete({ onComplete, disabled }: { onComplete: () => void; disabled?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const x = useMotionValue(0)

  useEffect(() => {
    if (trackRef.current) setWidth(Math.max(0, trackRef.current.offsetWidth - 56))
  }, [])

  return (
    <div ref={trackRef} className="relative h-14 rounded-full bg-son-surface-light overflow-hidden select-none">
      <div className="absolute inset-0 flex items-center justify-center text-sm text-son-silver-dim pointer-events-none">
        Arraste pra concluir a entrega →
      </div>
      <motion.div
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: 0, right: width }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() > width * 0.75) {
            animate(x, width, { duration: 0.15 })
            onComplete()
          } else {
            animate(x, 0, { duration: 0.2 })
          }
        }}
        className="absolute left-0 top-0 w-14 h-14 rounded-full sunset-bg flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        <ChevronsRight className="w-5 h-5 text-son-silver" />
      </motion.div>
    </div>
  )
}

export default function MotoboyCorrida() {
  const navigate = useNavigate()
  const [run, setRun] = useState<MotoboyRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [myPos, setMyPos] = useState<Ponto | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [route, setRoute] = useState<Rota | null>(null)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const myMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const lastSentRef = useRef(0)
  const myPosRef = useRef<Ponto | null>(null)
  // true assim que o motoboy arrasta/dá zoom manualmente — a partir daí o
  // mapa para de recentralizar sozinho até ele tocar em "Centralizar".
  const userMovedRef = useRef(false)
  // true só durante as nossas próprias chamadas de setView/fitBounds, pra
  // não confundir isso com interação manual do usuário.
  const suppressRef = useRef(false)

  // Reidrata a corrida ativa direto do banco — é isso que garante que ela
  // nunca "some" mesmo depois de um reload.
  useEffect(() => {
    let cancelled = false
    api.motoboy.runs
      .active()
      .then((r) => {
        if (cancelled) return
        if (!r) {
          navigate('/motoboy')
          return
        }
        setRun(r)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Não foi possível carregar a corrida.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  // O container do mapa fica sempre montado (mesmo durante o loading —
  // ver JSX abaixo), senão esse efeito roda antes da div existir de
  // verdade e, como as deps são [], nunca mais tenta de novo.
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, { zoomControl: false }).setView([FALLBACK.lat, FALLBACK.lng], 15)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 20 }).addTo(map)
    map.on('dragstart', () => {
      userMovedRef.current = true
    })
    map.on('zoomstart', () => {
      if (!suppressRef.current) userMovedRef.current = true
    })
    mapRef.current = map
    // Garante o tamanho certo mesmo se o layout mudar um pixel entre o
    // mount e a primeira pintura dos tiles.
    setTimeout(() => map.invalidateSize(), 0)
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const stop = seguirLocalizacao(
      (p) => {
        const pos = { lat: p.lat, lng: p.lng }
        myPosRef.current = pos
        setMyPos(pos)
        if (p.heading != null) setHeading(p.heading)
        const now = Date.now()
        if (now - lastSentRef.current > POSITION_UPDATE_MIN_MS) {
          lastSentRef.current = now
          api.motoboy.runs.updatePosition(p.lat, p.lng, p.heading).catch(() => {})
        }
      },
      () => setError('Não consegui acessar seu GPS. Ative a localização pra continuar navegando.')
    )
    return stop
  }, [])

  const current = run?.orders[run.current_index]

  // Busca a rota assim que a posição do motoboy fica disponível pela
  // primeira vez pra essa entrega (antes dependia só de current?.id, e se
  // o GPS demorasse mais que o fetch da corrida a rota nunca era buscada).
  useEffect(() => {
    if (!myPos || current?.customer_lat == null || current?.customer_lng == null) return
    let cancelled = false
    calcularRota(myPos, { lat: current.customer_lat, lng: current.customer_lng })
      .then((r) => {
        if (!cancelled) setRoute(r)
      })
      .catch(() => {
        if (!cancelled) setRoute(null)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, !!myPos])

  // Atualiza a rota periodicamente enquanto ele se desloca de verdade.
  useEffect(() => {
    if (current?.customer_lat == null || current?.customer_lng == null) return
    const lat = current.customer_lat
    const lng = current.customer_lng
    const interval = setInterval(() => {
      if (!myPosRef.current) return
      calcularRota(myPosRef.current, { lat, lng })
        .then(setRoute)
        .catch(() => {})
    }, ROUTE_REFRESH_MS)
    return () => clearInterval(interval)
  }, [current?.id])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !myPos) return

    if (!myMarkerRef.current) {
      myMarkerRef.current = L.marker([myPos.lat, myPos.lng], { icon: motoDivIcon(heading), zIndexOffset: 1000 }).addTo(map)
    } else {
      myMarkerRef.current.setLatLng([myPos.lat, myPos.lng])
      myMarkerRef.current.setIcon(motoDivIcon(heading))
    }

    if (current?.customer_lat != null && current?.customer_lng != null) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([current.customer_lat, current.customer_lng], { icon: destDivIcon() }).addTo(map)
      } else {
        destMarkerRef.current.setLatLng([current.customer_lat, current.customer_lng])
      }
    }

    if (route) {
      routeLineRef.current?.remove()
      routeLineRef.current = L.polyline(route.coords, { color: '#d5aa45', weight: 5, opacity: 0.85 }).addTo(map)
    }

    // Só recentraliza sozinho se o motoboy ainda não mexeu no mapa na mão —
    // uma vez que ele arrasta ou dá zoom, o mapa some de "seguir automático"
    // até ele tocar em "Centralizar".
    if (!userMovedRef.current) {
      suppressRef.current = true
      if (routeLineRef.current) {
        map.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] })
      } else {
        map.setView([myPos.lat, myPos.lng], 16)
      }
      suppressRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos, heading, route, current?.id])

  const recenter = () => {
    userMovedRef.current = false
    const map = mapRef.current
    if (!map || !myPos) return
    suppressRef.current = true
    if (routeLineRef.current) {
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] })
    } else {
      map.setView([myPos.lat, myPos.lng], 16)
    }
    suppressRef.current = false
  }

  const arrived =
    !!myPos &&
    current?.customer_lat != null &&
    current?.customer_lng != null &&
    distanciaKm(myPos, { lat: current.customer_lat, lng: current.customer_lng }) <= ARRIVAL_RADIUS_KM

  const needsPaymentConfirm = !!current && current.payment_method !== 'pix' && current.payment_status !== 'pago'

  const finishCurrent = async (paymentConfirmed?: boolean) => {
    setError(null)
    setCompleting(true)
    try {
      const updated = await api.motoboy.runs.completeCurrent(paymentConfirmed)
      setConfirmingPayment(false)
      if (updated.status === 'concluido') {
        navigate('/motoboy')
        return
      }
      setRun(updated)
      setRoute(null)
      userMovedRef.current = false
      destMarkerRef.current?.remove()
      destMarkerRef.current = null
      routeLineRef.current?.remove()
      routeLineRef.current = null
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível concluir a entrega.')
    } finally {
      setCompleting(false)
    }
  }

  const handleSwipe = () => {
    if (needsPaymentConfirm) {
      setConfirmingPayment(true)
      return
    }
    finishCurrent()
  }

  const copyAddress = () => {
    if (current?.customer_lat == null || current?.customer_lng == null) return
    navigator.clipboard.writeText(`${current.customer_lat},${current.customer_lng}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-black">Em rota</h1>
        {run && (
          <p className="text-xs text-son-silver-dim">
            Entrega {run.current_index + 1} de {run.order_ids.length}
          </p>
        )}
      </div>

      {error && <p className="error-msg mb-3">{error}</p>}

      {/* isolate: cria um novo stacking context pro mapa, senão os panes
          internos do Leaflet (z-index alto) podiam vazar por cima de
          outros elementos fixed da página, tipo FABs. */}
      <div className="relative isolate">
        <div ref={mapDivRef} className="w-full h-[55vh] rounded-2xl overflow-hidden border border-white/5" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-son-black/50 rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
          </div>
        )}
        {!loading && run && (
          <button
            onClick={recenter}
            className="absolute bottom-3 right-3 z-[500] w-10 h-10 flex items-center justify-center rounded-full bg-son-black/80 border border-white/10 text-white backdrop-blur-sm"
            aria-label="Centralizar mapa"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        )}
      </div>

      {!loading && !run && (
        <p className="text-sm text-son-silver-dim text-center py-8">Nenhuma corrida ativa no momento.</p>
      )}

      {run && current && (
        <div className="bg-son-surface border border-white/5 rounded-2xl p-4 mt-4">
          <p className="font-semibold text-son-silver">{current.customer_name}</p>
          <p className="text-sm text-son-silver-dim flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5" /> {current.neighborhood}
          </p>
          {current.reference_point && <p className="text-xs text-son-silver-dim italic mt-0.5">{current.reference_point}</p>}

          {current.customer_lat != null && current.customer_lng != null && (
            <div className="flex items-center gap-2 mt-2">
              <a
                href={`https://www.google.com/maps?q=${current.customer_lat},${current.customer_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 flex items-center gap-1.5 text-sm text-son-pink hover:underline truncate"
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{current.address || 'Abrir localização no mapa'}</span>
              </a>
              <button
                onClick={copyAddress}
                className="flex-shrink-0 text-son-silver-dim hover:text-son-pink"
                aria-label="Copiar coordenada"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          <p className="text-xs text-son-silver-dim mt-2">
            {route ? `${route.km.toFixed(1).replace('.', ',')} km · ${route.min} min` : 'Calculando rota…'}
          </p>

          <div className="mt-4">
            {arrived ? (
              <SwipeToComplete onComplete={handleSwipe} disabled={completing} />
            ) : (
              <div className="h-14 rounded-full bg-son-surface-light flex items-center justify-center text-sm text-son-silver-dim">
                A caminho — arraste pra concluir quando chegar
              </div>
            )}
          </div>
        </div>
      )}

      {confirmingPayment && current && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmingPayment(false)}
        >
          <div className="glass rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <PackageCheck className="w-8 h-8 text-son-gold mb-2" />
            <h3 className="font-bold text-son-silver mb-2">Confirmar pagamento</h3>
            <p className="text-sm text-son-silver-dim mb-5">
              Confirme que recebeu o pagamento em {current.payment_method} de{' '}
              <span className="sunset-text font-bold">{currency(current.total)}</span> para concluir a entrega.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingPayment(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={() => finishCurrent(true)} disabled={completing} className="btn-primary flex-1">
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
