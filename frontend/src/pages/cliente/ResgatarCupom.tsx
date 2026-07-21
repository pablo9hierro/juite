import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Loader2, PartyPopper } from 'lucide-react'
import SiteHeader from '../../components/layout/SiteHeader'
import PageTransition from '../../components/layout/PageTransition'
import CouponTicket from '../../components/CouponTicket'
import { api, ApiError } from '../../lib/api'
import type { ClaimedCoupon } from '../../lib/types'
import { useCustomerAuth } from '../../store/customerAuth'

// Precisam bater exatamente com .sunset-scratch-wrap no CSS (width/height
// fixos, de propósito -- ver comentário lá).
const SCRATCH_WIDTH = 300
const SCRATCH_HEIGHT = 380

// Desenha o "papel dourado" direto no canvas (gradiente do golden-button
// by elijahgummer + cantos em L + texto), em vez de ficar sincronizando
// via mask-image/toDataURL um card React separado por cima. Essa página é
// só pra celular — toDataURL() a cada frame (jeito antigo) é pesado
// demais pra acompanhar um dedo arrastando rápido num aparelho fraco, o
// resultado era a raspagem "sumir" sem nenhuma animação visível
// (reportado). Raspando direto no canvas com destination-out é uma
// operação de GPU baratíssima — o dourado desaparece exatamente onde o
// dedo passa, em tempo real, sem etapa intermediária nenhuma.
// Converte um ângulo de CSS linear-gradient (0deg = "to top", cresce em
// sentido horário) pros dois pontos que o canvas usa (createLinearGradient
// só aceita start/end point, não ângulo) -- mesmo algoritmo que o CSS usa
// por baixo dos panos, pra bater EXATAMENTE com a referência em vez de um
// ponto "no olho".
function gradientPontosPorAngulo(deg: number, w: number, h: number) {
  const rad = (deg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const comprimento = Math.abs(w * dx) + Math.abs(h * dy)
  const metade = comprimento / 2
  const cx = w / 2
  const cy = h / 2
  return { x0: cx - dx * metade, y0: cy - dy * metade, x1: cx + dx * metade, y1: cy + dy * metade }
}

// Uiverse.io by elijahgummer ("golden-button") clonado 1:1: mesmos 5 stops
// de cor no mesmo ângulo (160deg), borda #a55d07, e as duas linhas de
// "emboss" (inset shadow escura + inset highlight clara perto da borda de
// baixo) que dão o relevo metálico da referência.
function drawGoldFoil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = 18
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
  ctx.clip()

  const p = gradientPontosPorAngulo(160, w, h)
  const grad = ctx.createLinearGradient(p.x0, p.y0, p.x1, p.y1)
  grad.addColorStop(0, '#a54e07')
  grad.addColorStop(0.25, '#b47e11')
  grad.addColorStop(0.5, '#fef1a2')
  grad.addColorStop(0.75, '#bc881b')
  grad.addColorStop(1, '#a54e07')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // inset -2px 5px rgba(139,66,8,1) -- sombra escura colada na borda de baixo
  const shadowGrad = ctx.createLinearGradient(0, h - 10, 0, h)
  shadowGrad.addColorStop(0, 'rgba(139,66,8,0)')
  shadowGrad.addColorStop(1, 'rgba(139,66,8,0.9)')
  ctx.fillStyle = shadowGrad
  ctx.fillRect(0, h - 10, w, 10)

  // inset -1px 1px 3px rgba(250,227,133,1) -- friso claro logo acima da sombra
  ctx.strokeStyle = 'rgba(250,227,133,0.9)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(4, h - 4)
  ctx.lineTo(w - 4, h - 4)
  ctx.stroke()

  ctx.strokeStyle = '#a55d07'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1)

  const sheen = ctx.createLinearGradient(0, 0, w, h)
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  sheen.addColorStop(0.65, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(120,50,5,0.7)'
  ctx.lineWidth = 2
  const cl = 16
  const inset = 10
  ctx.beginPath()
  ctx.moveTo(inset, inset + cl)
  ctx.lineTo(inset, inset)
  ctx.lineTo(inset + cl, inset)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w - inset - cl, inset)
  ctx.lineTo(w - inset, inset)
  ctx.lineTo(w - inset, inset + cl)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(inset, h - inset - cl)
  ctx.lineTo(inset, h - inset)
  ctx.lineTo(inset + cl, h - inset)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w - inset - cl, h - inset)
  ctx.lineTo(w - inset, h - inset)
  ctx.lineTo(w - inset, h - inset - cl)
  ctx.stroke()

  ctx.fillStyle = 'rgba(120,50,5,0.92)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 17px system-ui, sans-serif'
  ctx.fillText('RASPE AQUI', w / 2, h / 2 - 10)
  ctx.font = '400 11px system-ui, sans-serif'
  ctx.fillText('arraste o dedo pra revelar seu cupom', w / 2, h / 2 + 16)

  ctx.restore()
}

// Igual uma raspadinha física, o prêmio (CouponTicket, ver
// components/CouponTicket.tsx) já está TODO renderizado por baixo desde o
// início — não é revelado por uma RPC depois de raspar, é só coberto
// visualmente pelo papel dourado. resgatar_cupom (RPC) roda uma única vez,
// assim que a página confirma que tem cupom pra resgatar; raspar é só a
// animação de descobrir o que já foi concedido.
export default function ResgatarCupom() {
  const { token } = useCustomerAuth()
  const [checking, setChecking] = useState(true)
  const [claimable, setClaimable] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fading, setFading] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [claimed, setClaimed] = useState<ClaimedCoupon | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const rafPending = useRef(false)

  useEffect(() => {
    if (!token) return
    api.customerAuth
      .hasClaimableCoupon(token)
      .then((has) => {
        setClaimable(has)
        if (!has) return
        // Só espia os dados pra desenhar o ticket por baixo do papel
        // dourado -- NÃO marca nada como resgatado ainda. Recarregar a
        // página quantas vezes for não gasta cupom nenhum (o resgate de
        // verdade só acontece em completeReveal, ao terminar de raspar).
        return api.customerAuth
          .peekClaimableCoupon(token)
          .then(setClaimed)
          .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o cupom.'))
      })
      .catch(() => setClaimable(false))
      .finally(() => setChecking(false))
  }, [token])

  // O <canvas> usa dimensões FIXAS (mesmas de .sunset-scratch-wrap no
  // CSS) em vez de medir via getBoundingClientRect()/ResizeObserver -- a
  // medição dinâmica era exatamente a fonte da instabilidade (card
  // aparecendo gigante/quebrado, reportado repetidas vezes): qualquer
  // timing de layout ainda não assentado no momento da medição inflava o
  // canvas junto. Com tamanho fixo conhecido de antemão, não existe
  // medição nenhuma pra dar errado -- o desenho fica correto sempre,
  // desde o primeiro frame.
  useEffect(() => {
    if (checking || !claimable || !claimed) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = SCRATCH_WIDTH * dpr
    canvas.height = SCRATCH_HEIGHT * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawGoldFoil(ctx, SCRATCH_WIDTH, SCRATCH_HEIGHT)
  }, [checking, claimable, claimed])

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
    ctx.lineWidth = 42
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
    let sampled = 0
    for (let i = 3; i < data.length; i += 4 * 16) {
      if (data[i] < 40) cleared++
      sampled++
    }
    const pct = Math.min(100, Math.round((cleared / sampled) * 100))
    setProgress(pct)
    if (pct >= 55) completeReveal()
  }

  function scheduleProgressCheck() {
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      computeProgress()
      rafPending.current = false
    })
  }

  function completeReveal() {
    if (fading || revealed) return
    setFading(true)
    setProgress(100)
    window.setTimeout(() => setRevealed(true), 500)
    // Só AGORA (terminou de raspar de verdade) o resgate é gravado no
    // banco -- não no carregamento da página.
    if (!token) return
    api.customerAuth
      .claimCoupon(token)
      .then(setClaimed)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível resgatar o cupom.'))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (revealed || fading) return
    e.preventDefault()
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
    drawing.current = true
    const p = getPos(e)
    lastPoint.current = p
    scratchLine(p, { x: p.x + 0.1, y: p.y + 0.1 })
    scheduleProgressCheck()
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || revealed || fading) return
    e.preventDefault()
    const p = getPos(e)
    scratchLine(lastPoint.current ?? p, p)
    lastPoint.current = p
    scheduleProgressCheck()
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
      <PageTransition className="max-w-lg mx-auto px-5 sm:px-10 pt-3 pb-4 flex flex-col items-center">
        {checking ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
          </div>
        ) : !claimable || !claimed ? (
          <div className="text-center py-16 text-son-silver-dim">
            {error ? (
              <p className="error-msg">{error}</p>
            ) : (
              <p>Você não tem nenhum cupom disponível pra resgatar no momento.</p>
            )}
            <Link to="/cliente/cupons" className="btn-primary inline-flex mt-4">
              Voltar pra meus cupons
            </Link>
          </div>
        ) : (
          <>
            <div className="sunset-scratch-wrap">
              <CouponTicket coupon={claimed} />
              {!revealed && (
                <canvas
                  ref={canvasRef}
                  className={`sunset-scratch-canvas ${fading ? 'sunset-scratch-canvas-fade' : ''}`}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              )}
            </div>

            {!revealed && (
              <>
                <p className="sunset-scratch-hint">Arraste o dedo sobre o cartão pra raspar e revelar seu cupom.</p>
                <div className="sunset-scratch-progress-track">
                  <div className="sunset-scratch-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </>
            )}

            {revealed && (
              <div className="text-center mt-5">
                {error ? (
                  <p className="error-msg">{error}</p>
                ) : (
                  <>
                    <p className="flex items-center justify-center gap-2 text-lg font-bold sunset-text">
                      <PartyPopper className="w-5 h-5" /> Cupom resgatado!
                    </p>
                    <p className="text-sm text-son-silver-dim mt-1">
                      O cupom <span className="font-mono font-bold text-white">{claimed.code}</span> já está na sua carteira, pronto pra usar no checkout.
                    </p>
                  </>
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
