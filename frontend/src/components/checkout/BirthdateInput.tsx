import { useEffect, useRef, useState } from 'react'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function daysInMonth(month: number, year: number): number {
  if (!month) return 31
  return new Date(year || 2000, month, 0).getDate()
}

function parse(value: string): [number | undefined, number | undefined, number | undefined] {
  if (!value) return [undefined, undefined, undefined]
  const [y, m, d] = value.split('-').map(Number)
  return [y, m, d]
}

// Value/onChange sempre em yyyy-mm-dd (formato que o backend espera) — só a
// APRESENTAÇÃO é dia/mês/ano, via 3 selects em vez do <input type="date">
// nativo (cujo formato/calendário segue o locale do navegador, não o
// nosso — ficava em mm/dd/yyyy mesmo com o site em pt-BR).
//
// Dia/mês/ano moram em estado local (não só derivados de `value`): como só
// emitimos onChange pro pai quando os 3 estão preenchidos, se a seleção
// fosse 100% controlada por `value` cada escolha parcial (ex: só o dia)
// disparava onChange('') e o próprio componente re-renderizava com os 3
// selects vazios de novo — a data nunca ficava selecionada. `lastEmitted`
// distingue "o pai ecoou o que eu acabei de mandar" (ignora) de "o pai
// resetou/carregou um valor por fora" (aí sim resincroniza os selects).
export default function BirthdateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const initial = parse(value)
  const [year, setYear] = useState<number | undefined>(initial[0])
  const [month, setMonth] = useState<number | undefined>(initial[1])
  const [day, setDay] = useState<number | undefined>(initial[2])
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    const [y, m, d] = parse(value)
    setYear(y)
    setMonth(m)
    setDay(d)
  }, [value])

  const thisYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = thisYear - 18; y >= thisYear - 100; y--) years.push(y)

  const maxDay = daysInMonth(month ?? 0, year ?? 0)
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)

  const commit = (nextDay: number | undefined, nextMonth: number | undefined, nextYear: number | undefined) => {
    setDay(nextDay)
    setMonth(nextMonth)
    setYear(nextYear)
    const next =
      nextDay && nextMonth && nextYear
        ? `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`
        : ''
    lastEmitted.current = next
    onChange(next)
  }

  // Visual "dial mecânico" (Uiverse by dexter-st, "combination lock") por
  // cima do <select> nativo — só a moldura muda, o comportamento/valor
  // continua 100% o <select> de sempre (mesma correção do bug de data que
  // não registrava, intacta).
  const selectClass =
    'sunset-dial-select input-field appearance-none cursor-pointer'

  return (
    <div className="grid grid-cols-[1fr_1.4fr_1.1fr] gap-2">
      <select
        className={selectClass}
        value={day ?? ''}
        onChange={(e) => commit(e.target.value ? Number(e.target.value) : undefined, month, year)}
        aria-label="Dia"
      >
        <option value="">Dia</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={month ?? ''}
        onChange={(e) => {
          const m = e.target.value ? Number(e.target.value) : undefined
          // Se o dia escolhido não existe no novo mês (ex: 31 de fevereiro), ajusta.
          const clampedDay = day && m ? Math.min(day, daysInMonth(m, year ?? thisYear)) : day
          commit(clampedDay, m, year)
        }}
        aria-label="Mês"
      >
        <option value="">Mês</option>
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={year ?? ''}
        onChange={(e) => commit(day, month, e.target.value ? Number(e.target.value) : undefined)}
        aria-label="Ano"
      >
        <option value="">Ano</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
