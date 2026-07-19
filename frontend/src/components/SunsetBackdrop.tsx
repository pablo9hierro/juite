// Uiverse.io by aadium — era um card pequeno (250x320) com um SVG de
// praia/palmeiras/sol num fundo em gradiente, mais um texto sobreposto.
// Aqui vira a camada de fundo FIXA de toda a experiência do cliente (a
// referência não trazia o markup do SVG original, só as classes de
// estilo — a cena de praia foi recriada do zero seguindo a mesma
// composição descrita: céu em gradiente, sol refletindo na água,
// palmeiras em silhueta, pássaros ao fundo). Cores mantidas dentro da
// paleta sunset do site (a referência original usava magenta/ciano neon,
// que destoaria do resto — item explicitamente permitiu manter as cores
// originais, mas isso quebraria a identidade visual usada em todo o
// resto do site). Texto trocado pra "Sunset Tabas" / "tabacaria".
function PalmTree({ x, y, scale = 1, flip = false }: { x: number; y: number; scale?: number; flip?: boolean }) {
  const fronds = [-65, -32, -6, 22, 52]
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} fill="#050f0a">
      <path d="M0,0 C-7,-42 -2,-92 15,-132 C7,-98 5,-46 7,0 Z" />
      {fronds.map((deg) => (
        <ellipse key={deg} cx="0" cy="0" rx="72" ry="15" transform={`translate(15 -132) rotate(${deg})`} />
      ))}
    </g>
  )
}

export default function SunsetBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-son-black pointer-events-none" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="bdSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#081912" />
            <stop offset="42%" stopColor="#b57c27" />
            <stop offset="70%" stopColor="#e08a3a" />
            <stop offset="100%" stopColor="#081912" />
          </linearGradient>
          <radialGradient id="bdSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd23d" />
            <stop offset="100%" stopColor="#e08a3a" />
          </radialGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#bdSky)" />
        <circle cx="600" cy="555" r="150" fill="url(#bdSun)" />
        <g opacity="0.55">
          <rect x="420" y="635" width="360" height="8" fill="#ffd23d" />
          <rect x="452" y="658" width="296" height="6" fill="#ffd23d" opacity="0.7" />
          <rect x="482" y="678" width="236" height="6" fill="#ffd23d" opacity="0.5" />
          <rect x="512" y="696" width="176" height="5" fill="#ffd23d" opacity="0.35" />
        </g>
        <g stroke="#050f0a" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.55">
          <path d="M180 150 q18 -20 36 0 q18 -20 36 0" />
          <path d="M270 205 q14 -16 28 0 q14 -16 28 0" />
          <path d="M940 135 q16 -18 32 0 q16 -18 32 0" />
        </g>
        <g opacity="0.94">
          <PalmTree x={130} y={900} scale={1.3} />
          <PalmTree x={1070} y={900} scale={1.15} flip />
        </g>
      </svg>
      <div className="absolute inset-x-0 top-8 sm:top-12 flex flex-col items-center text-center px-4">
        <span className="sunset-text text-4xl sm:text-6xl font-black tracking-tight">Sunset Tabas</span>
        <span className="text-son-silver-dim text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase mt-1">
          tabacaria
        </span>
      </div>
    </div>
  )
}
