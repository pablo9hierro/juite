import { useRef } from 'react'
import { Gift } from 'lucide-react'

const GRID = Array.from({ length: 25 }, (_, i) => i) // 5x5 = 25 células de hover

// Uiverse.io by 00Kubi ("Cyber Card") — clone 1:1 da estrutura: grade
// invisível de 25 células sobre o card, cada uma seta um ângulo de
// tilt 3D diferente (rotateX/rotateY via custom properties) conforme a
// posição do mouse ao passar por cima, mais brilho/glare acompanhando,
// scanline, partículas de glow e cantos em L. Recolorido pro
// laranja/dourado/roxo sunset (era ciano/roxo neon). Sem hover (mobile),
// o card fica com um tilt suave em loop contínuo — com hover (desktop),
// a grade assume o controle e dá o tilt dramático célula a célula, igual
// a referência.
export default function CyberCard({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleEnter = (row: number, col: number) => {
    const el = cardRef.current
    if (!el) return
    const rx = (2 - row) * 10 // linha 0 (topo) -> +20deg, linha 4 (fundo) -> -20deg
    const ry = (col - 2) * 10 // coluna 0 (esq) -> -20deg, coluna 4 (dir) -> +20deg
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
    el.style.setProperty('--glare-x', `${(col / 4) * 100}%`)
    el.style.setProperty('--glare-y', `${(row / 4) * 100}%`)
    el.classList.add('sunset-cyber-card-active')
  }

  const handleLeave = () => {
    const el = cardRef.current
    if (!el) return
    el.classList.remove('sunset-cyber-card-active')
    el.style.removeProperty('--rx')
    el.style.removeProperty('--ry')
  }

  return (
    <div ref={cardRef} className={`sunset-cyber-card ${className ?? ''}`} style={style} onMouseLeave={handleLeave}>
      <div className="sunset-cyber-card-scanline" />
      <div className="sunset-cyber-card-glare" />
      <span className="sunset-cyber-card-corner sunset-cyber-card-corner-tl" />
      <span className="sunset-cyber-card-corner sunset-cyber-card-corner-tr" />
      <span className="sunset-cyber-card-corner sunset-cyber-card-corner-bl" />
      <span className="sunset-cyber-card-corner sunset-cyber-card-corner-br" />
      <div className="sunset-cyber-card-particles">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="sunset-cyber-card-particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="sunset-cyber-card-content">
        <Gift className="sunset-cyber-card-icon" />
        <p className="sunset-cyber-card-label">Raspe aqui</p>
      </div>
      <div className="sunset-cyber-card-grid">
        {GRID.map((i) => (
          <div key={i} className="sunset-cyber-card-cell" onMouseEnter={() => handleEnter(Math.floor(i / 5), i % 5)} />
        ))}
      </div>
    </div>
  )
}
