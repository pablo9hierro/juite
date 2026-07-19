import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

// QR code ilustrativo (não escaneia nada de verdade) — gerado 100% em
// código: uma grade de módulos onde um vira e outro sempre trocam de
// posição em loop (Framer Motion anima o deslocamento sozinho via
// `layout`, cada módulo mantém sua própria identidade/key entre as
// trocas), mais uma lupa deslizando por cima simulando "sendo escaneado".
const GRID = 6
const FILLED_RATIO = 0.42
const SWAP_INTERVAL_MS = 650

function randomFilledPositions(): number[] {
  const total = GRID * GRID
  const count = Math.floor(total * FILLED_RATIO)
  const all = Array.from({ length: total }, (_, i) => i)
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, count)
}

function FinderPattern({ corner }: { corner: 'tl' | 'tr' | 'bl' }) {
  const pos =
    corner === 'tl' ? { left: 0, top: 0 } : corner === 'tr' ? { right: 0, top: 0 } : { left: 0, bottom: 0 }
  const cell = 100 / GRID
  return (
    <div
      className="absolute bg-son-black"
      style={{ ...pos, width: `${cell * 1.6}%`, height: `${cell * 1.6}%`, padding: '14%' }}
    >
      <div className="w-full h-full bg-white" style={{ padding: '18%' }}>
        <div className="w-full h-full bg-son-black" />
      </div>
    </div>
  )
}

export default function QrScanMock() {
  const [squares, setSquares] = useState(() => randomFilledPositions().map((pos, id) => ({ id, pos })))

  useEffect(() => {
    const interval = setInterval(() => {
      setSquares((prev) => {
        const total = GRID * GRID
        const occupied = new Set(prev.map((s) => s.pos))
        const empties = Array.from({ length: total }, (_, i) => i).filter((i) => !occupied.has(i))
        if (empties.length === 0 || prev.length === 0) return prev
        const idx = Math.floor(Math.random() * prev.length)
        const newPos = empties[Math.floor(Math.random() * empties.length)]
        return prev.map((s, i) => (i === idx ? { ...s, pos: newPos } : s))
      })
    }, SWAP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-24 h-24 flex-shrink-0 bg-white rounded-xl p-2.5 shadow-inner overflow-hidden">
      <div className="relative w-full h-full">
        {squares.map((s) => {
          const row = Math.floor(s.pos / GRID)
          const col = s.pos % GRID
          return (
            <motion.div
              key={s.id}
              layout
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="absolute bg-son-black rounded-[1px]"
              style={{
                width: `${100 / GRID}%`,
                height: `${100 / GRID}%`,
                left: `${(col / GRID) * 100}%`,
                top: `${(row / GRID) * 100}%`,
              }}
            />
          )
        })}
        <FinderPattern corner="tl" />
        <FinderPattern corner="tr" />
        <FinderPattern corner="bl" />
        <motion.div
          className="absolute text-son-orange drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
          animate={{
            left: ['8%', '58%', '28%', '68%', '8%'],
            top: ['10%', '18%', '62%', '52%', '10%'],
            scale: [1, 1.18, 1, 1.18, 1],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Search className="w-6 h-6" strokeWidth={2.5} />
        </motion.div>
      </div>
    </div>
  )
}
