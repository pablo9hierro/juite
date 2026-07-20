import type { CSSProperties } from 'react'
import './FireLoader.css'

// Mesmos 100 valores --n exatos da referência (Uiverse.io by
// SelfMadeSystem), na mesma ordem.
const BALL_SEEDS = [
  0.8865, 0.1355, 0.7449, 0.8842, 0.9783, 0.2639, 0.8008, 0.0349, 0.816, 0.4397,
  0.7457, 0.0481, 0.41, 0.1041, 0.9967, 0.3815, 0.452, 0.2286, 0.8291, 0.9617,
  0.3374, 0.7277, 0.8969, 0.3096, 0.386, 0.2347, 0.4591, 0.045, 0.0815, 0.91,
  0.9737, 0.4185, 0.1508, 0.9323, 0.0341, 0.8304, 0.3449, 0.3398, 0.0458, 0.0326,
  0.5843, 0.1483, 0.3297, 0.2765, 0.1764, 0.9811, 0.8625, 0.9378, 0.4417, 0.0425,
  0.144, 0.2503, 0.605, 0.7947, 0.3677, 0.5063, 0.0301, 0.3217, 0.1559, 0.9862,
  0.0212, 0.9632, 0.2334, 0.0241, 0.9374, 0.2286, 0.6427, 0.6731, 0.8664, 0.7627,
  0.7768, 0.6954, 0.3915, 0.9714, 0.3935, 0.4859, 0.1976, 0.5246, 0.643, 0.3265,
  0.6532, 0.7922, 0.8988, 0.9969, 0.2227, 0.8205, 0.293, 0.1042, 0.3598, 0.2926,
  0.7555, 0.1403, 0.5981, 0.6467, 0.9956, 0.6911, 0.4679, 0.1181, 0.347, 0.6709,
]

const BLUR_LINES: CSSProperties[] = [
  { '--s': '0', '--e': '25%', '--p': '50px' } as CSSProperties,
  { '--s': '25%', '--e': '75%', '--p': '10px' } as CSSProperties,
  { '--s': '50%', '--e': '87.5%', '--p': '5px' } as CSSProperties,
  { '--s': '75%', '--e': '100%', '--p': '1px' } as CSSProperties,
]

// Uiverse.io by SelfMadeSystem — decorativo, pointer-events:none (não é
// botão, quem manda pro /checkout continua sendo só o #cart-icon).
export default function FireLoader() {
  return (
    <div className="sunset-fire-loader-wrap" aria-hidden="true">
      <div className="sunset-fire-loader">
        <div className="sunset-fire">
          {BALL_SEEDS.map((n, i) => (
            <div key={i} className="sunset-fire-ball" style={{ '--n': n } as CSSProperties} />
          ))}
        </div>
        <div className="sunset-fire-blur">
          {BLUR_LINES.map((style, i) => (
            <div key={i} className="sunset-fire-line" style={style} />
          ))}
        </div>
        <div className="sunset-fire-overlay" />
      </div>
    </div>
  )
}
