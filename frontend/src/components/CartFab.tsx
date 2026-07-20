import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'
import { api } from '../lib/api'
import type { SmokeSettings } from '../lib/types'
import SunsetCartIcon from './SunsetCartIcon'

const DEFAULT_SMOKE: SmokeSettings = { smoke_speed: 3, smoke_count: 9, smoke_width: 64, smoke_height: 70 }

// Drift alternado (sinal/magnitude variando por índice) pra cada
// baforada desviar pro lado de um jeito diferente enquanto sobe — sem
// isso todas subiam retas empilhadas, o que com várias baforadas juntas
// lia como um movimento "helicoidal"/espiral em vez de fumaça natural.
const DRIFT_PATTERN = [-16, 12, -22, 8, -10, 20, -14, 16, -8, 18, -20, 10]

export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const [smoke, setSmoke] = useState<SmokeSettings>(DEFAULT_SMOKE)

  useEffect(() => {
    api.siteSettings
      .get()
      .then((s) => setSmoke({ smoke_speed: s.smoke_speed, smoke_count: s.smoke_count, smoke_width: s.smoke_width, smoke_height: s.smoke_height }))
      .catch(() => {})
  }, [])

  const n = Math.max(smoke.smoke_count, 1)
  const puffs = Array.from({ length: n }, (_, i) => ({
    left: n === 1 ? 50 : (i / (n - 1)) * 100,
    drift: DRIFT_PATTERN[i % DRIFT_PATTERN.length],
    delay: (smoke.smoke_speed / n) * i,
  }))

  return (
    <Link to="/carrinho" className="fixed bottom-6 right-6 z-40 w-16 h-16 flex items-center justify-center" aria-label="Ir para o carrinho">
      {/* Atrás do #cart-icon (z-index:2) de propósito — a fumaça nunca
          deve tampar o ícone/contador, só decorar em volta. */}
      <div className="sunset-smoke-wrap" style={{ width: `${smoke.smoke_width}px` }}>
        {puffs.map((p, i) => (
          <span
            key={i}
            className="sunset-smoke"
            style={
              {
                left: `${p.left}%`,
                '--drift': `${p.drift}px`,
                '--rise': `${-smoke.smoke_height}px`,
                animationDuration: `${smoke.smoke_speed}s`,
                animationDelay: `${p.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <SunsetCartIcon scale={0.42} />
      {count > 0 && (
        <span className="absolute top-2 right-0 z-10 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
