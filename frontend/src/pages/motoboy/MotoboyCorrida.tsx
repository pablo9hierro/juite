import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { animate, motion, useMotionValue } from 'framer-motion'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronsRight, Compass, Loader2, Map as MapIcon, MapPin, PackageCheck } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { seguirLocalizacao } from '../../lib/geo/localizacao'
import { calcularRota, distanciaKm } from '../../lib/geo/rotas'
import { FALLBACK, TILE_ATTR, TILE_URL } from '../../lib/geo/mapa'
import type { Ponto, Rota } from '../../lib/geo/tipos'
import type { MotoboyRun } from '../../lib/types'

const ARRIVAL_RADIUS_KM = 0.08 // ~80m — dá pra considerar "chegou"
const POSITION_UPDATE_MIN_MS = 4000

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function motoIcon(heading: number | null) {
  return L.divIcon({
    className: 'icone-limpo',
    html: `<div style="font-size:26px;transform:rotate(${heading ?? 0}deg);transition:transform .3s">🛵</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function destIcon() {
  return L.divIcon({
    className: 'icone-limpo',
    html: `<div style="font-size:28px">📍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  })
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
        <ChevronsRight className="w-5 h-5 text-white" />
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
  const [view, setView] = useState<'primeira' | 'terceira'>('terceira')
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const myMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const lastSentRef = useRef(0)

  // Reidrata a corrida ativa direto do banco — é isso que garante que ela
  // nunca "some" mesmo depois de um reload.
  useEffect(() => {
    api.motoboy.runs
      .active()
      .then((r) => {
        if (!r) {
          navigate('/motoboy')
          return
        }
        setRun(r)
      })
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return
    const map = L.map(mapDivRef.current, { zoomControl: false }).setView([FALLBACK.lat, FALLBACK.lng], 15)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 20 }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const stop = seguirLocalizacao(
      (p) => {
        setMyPos({ lat: p.lat, lng: p.lng })
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

  useEffect(() => {
    if (!myPos || current?.customer_lat == null || current?.customer_lng == null) return
    calcularRota(myPos, { lat: current.customer_lat, lng: current.customer_lng })
      .then(setRoute)
      .catch(() => setRoute(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !myPos) return

    if (!myMarkerRef.current) {
      myMarkerRef.current = L.marker([myPos.lat, myPos.lng], { icon: motoIcon(heading), zIndexOffset: 1000 }).addTo(map)
    } else {
      myMarkerRef.current.setLatLng([myPos.lat, myPos.lng])
      myMarkerRef.current.setIcon(motoIcon(heading))
    }

    if (current?.customer_lat != null && current?.customer_lng != null) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([current.customer_lat, current.customer_lng], { icon: destIcon() }).addTo(map)
      } else {
        destMarkerRef.current.setLatLng([current.customer_lat, current.customer_lng])
      }
    }

    if (route) {
      routeLineRef.current?.remove()
      routeLineRef.current = L.polyline(route.coords, { color: '#d5aa45', weight: 5, opacity: 0.85 }).addTo(map)
    }

    if (view === 'primeira') {
      map.setView([myPos.lat, myPos.lng], 18)
    } else if (routeLineRef.current) {
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] })
    } else {
      map.setView([myPos.lat, myPos.lng], 15)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos, heading, route, view, current?.id])

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

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
      </div>
    )
  }
  if (!run || !current) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">Em rota</h1>
          <p className="text-xs text-son-silver-dim">
            Entrega {run.current_index + 1} de {run.order_ids.length}
          </p>
        </div>
        <button
          onClick={() => setView((v) => (v === 'primeira' ? 'terceira' : 'primeira'))}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-son-surface border border-white/5 text-son-silver hover:border-son-pink/30"
        >
          {view === 'primeira' ? <Compass className="w-3.5 h-3.5" /> : <MapIcon className="w-3.5 h-3.5" />}
          {view === 'primeira' ? '1ª pessoa' : '3ª pessoa'}
        </button>
      </div>

      {error && <p className="error-msg mb-3">{error}</p>}

      <div ref={mapDivRef} className="w-full h-[55vh] rounded-2xl overflow-hidden border border-white/5" />

      <div className="bg-son-surface border border-white/5 rounded-2xl p-4 mt-4">
        <p className="font-semibold text-white">{current.customer_name}</p>
        <p className="text-sm text-son-silver-dim flex items-center gap-1 mt-0.5">
          <MapPin className="w-3.5 h-3.5" /> {current.neighborhood}
        </p>
        {current.reference_point && <p className="text-xs text-son-silver-dim italic mt-0.5">{current.reference_point}</p>}
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

      {confirmingPayment && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmingPayment(false)}
        >
          <div className="glass rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <PackageCheck className="w-8 h-8 text-son-gold mb-2" />
            <h3 className="font-bold text-white mb-2">Confirmar pagamento</h3>
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
