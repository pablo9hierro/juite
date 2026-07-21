import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Loader2, PartyPopper } from 'lucide-react'
import SiteHeader from '../../components/layout/SiteHeader'
import PageTransition from '../../components/layout/PageTransition'
import CyberCard from '../../components/CyberCard'
import CouponTicket from '../../components/CouponTicket'
import { api, ApiError } from '../../lib/api'
import type { ClaimedCoupon } from '../../lib/types'
import { useCustomerAuth } from '../../store/customerAuth'

// Efeito "Raspadinha": a raspadinha em si é o CyberCard (Uiverse.io by
// 00Kubi, clone completo) sobreposto ao cupom azul revelado por baixo. Um
// <canvas> transparente por cima captura o arrastar do dedo/mouse e serve
// só de MÁSCARA (mask-image) pro wrapper do CyberCard — onde o canvas fica
// "apagado" (destination-out), o CyberCard vira invisível ali e mostra o
// cupom azul por baixo. Assim o card raspado continua sendo o componente
// React de verdade (com toda a animação/tilt), não um desenho estático no
// canvas. Ao passar de ~55% raspado, revela tudo de vez e chama a RPC de
// resgate (o valor do cupom só existe no cliente DEPOIS de raspar).
export default function ResgatarCupom() {
  const { token } = useCustomerAuth()
  const [checking, setChecking] = useState(true)
  const [claimable, setClaimable] = useState(false)
  const [progress, setProgress] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [claimed, setClaimed] = useState<ClaimedCoupon | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskWrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const claimTriggered = useRef(false)
  const rafPending = useRef(false)

  useEffect(() => {
    if (!token) return
    api.customerAuth
      .hasClaimableCoupon(token)
      .then(setClaimable)
      .catch(() => setClaimable(false))
      .finally(() => setChecking(false))
  }, [token])

  useEffect(() => {
    if (checking || !claimable) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    updateMask()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, claimable])

  function updateMask() {
    const canvas = canvasRef.current
    const wrap = maskWrapRef.current
    if (!canvas || !wrap) return
    const url = `url(${canvas.toDataURL()})`
    wrap.style.maskImage = url
    wrap.style.setProperty('-webkit-mask-image', url)
    wrap.style.maskSize = '100% 100%'
    wrap.style.setProperty('-webkit-mask-size', '100% 100%')
  }

  function scheduleMaskUpdate() {
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      updateMask()
      rafPending.current = false
    })
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function scratchLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 38
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  function computeProgress() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let cleared = 0
    const total = data.length / 4
    for (let i = 3; i < data.length; i += 4 * 12) {
      // amostra 1 a cada 12 pixels — suficiente pra estimar % e bem mais rápido
      if (data[i] < 40) cleared++
    }
    const pct = Math.min(100, Math.round((cleared / (total / 12)) * 100))
    setProgress(pct)
    if (pct >= 55) completeReveal()
  }

  function completeReveal() {
    if (claimTriggered.current || !token) return
    claimTriggered.current = true
    setRevealed(true)
    setProgress(100)
    const wrap = maskWrapRef.current
    if (wrap) {
      wrap.style.transition = 'opacity 0.6s ease'
      wrap.style.opacity = '0'
    }
    api.customerAuth
      .claimCoupon(token)
      .then(setClaimed)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível resgatar o cupom.'))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (revealed) return
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
    drawing.current = true
    const p = getPos(e)
    lastPoint.current = p
    scratchLine(p, { x: p.x + 0.1, y: p.y + 0.1 })
    scheduleMaskUpdate()
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || revealed) return
    const p = getPos(e)
    scratchLine(lastPoint.current ?? p, p)
    lastPoint.current = p
    scheduleMaskUpdate()
  }

  function handlePointerUp() {
    if (!drawing.current) return
    drawing.current = false
    lastPoint.current = null
    computeProgress()
  }

  if (!token) return <Navigate to="/" replace />

  return (
    <main className="min-h-screen text-white">
      <SiteHeader showCart={false} showProfile={false} title="Resgatar cupom" />
      <PageTransition className="max-w-lg mx-auto px-5 sm:px-10 pt-6 pb-16 flex flex-col items-center">
        {checking ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
          </div>
        ) : !claimable && !claimed ? (
          <div className="text-center py-16 text-son-silver-dim">
            <p>Você não tem nenhum cupom disponível pra resgatar no momento.</p>
            <Link to="/cliente/cupons" className="btn-primary inline-flex mt-4">
              Voltar pra meus cupons
            </Link>
          </div>
        ) : (
          <>
            <div className="sunset-scratch-wrap">
              {claimed ? <CouponTicket coupon={claimed} /> : <div className="sunset-scratch-placeholder">🎁</div>}
              <div ref={maskWrapRef} className="absolute inset-0">
                <CyberCard style={{ width: '100%', height: '100%' }} />
              </div>
              {!revealed && (
                <canvas
                  ref={canvasRef}
                  className="sunset-scratch-canvas"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              )}
            </div>

            {!revealed && (
              <>
                <p className="sunset-scratch-hint">Arraste o dedo (ou o mouse) sobre o cartão pra raspar e revelar seu cupom.</p>
                <div className="sunset-scratch-progress-track">
                  <div className="sunset-scratch-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </>
            )}

            {revealed && (
              <div className="text-center mt-5">
                {error ? (
                  <p className="error-msg">{error}</p>
                ) : claimed ? (
                  <>
                    <p className="flex items-center justify-center gap-2 text-lg font-bold sunset-text">
                      <PartyPopper className="w-5 h-5" /> Cupom resgatado!
                    </p>
                    <p className="text-sm text-son-silver-dim mt-1">
                      O cupom <span className="font-mono font-bold text-white">{claimed.code}</span> já está na sua carteira, pronto pra usar no checkout.
                    </p>
                  </>
                ) : (
                  <Loader2 className="w-6 h-6 animate-spin text-son-pink mx-auto" />
                )}
                <Link to="/cliente/cupons" className="btn-primary inline-flex mt-4">
                  Ver meus cupons
                </Link>
              </div>
            )}
          </>
        )}
      </PageTransition>
    </main>
  )
}
