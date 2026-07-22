import { useEffect, useRef, useState } from 'react'
import { Flame, ImagePlus, Loader2, Plus, Trash2, Wind } from 'lucide-react'
import Card from '../../components/ui/Card'
import { api, ApiError } from '../../lib/api'
import type { DecorElementType, PageDecoration, PageDecorationElement, PageKey } from '../../lib/types'

const MAX_BG_MB = 10

const PAGE_TABS: { key: PageKey; label: string; path: string }[] = [
  { key: 'landing', label: 'Landing', path: '/' },
  { key: 'catalogo', label: 'Catálogo', path: '/catalogo' },
  { key: 'favoritos', label: 'Favoritos', path: '/cliente/favoritos' },
  { key: 'cupons', label: 'Cupons', path: '/cliente/cupons' },
  { key: 'historico', label: 'Histórico', path: '/cliente/historico' },
]

// Preview num tamanho fixo de celular (390×760), exibido reduzido via
// transform:scale — getBoundingClientRect() do container já escalado
// continua dando a proporção certa, então o x/y em % calculado ali bate
// exatamente com o x/y em % da página real (mesmo sistema de coordenadas
// dos dois lados, só que um visualmente menor).
const PREVIEW_W = 390
const PREVIEW_H = 760
const PREVIEW_SCALE = 0.8

function emptyDecoration(pageKey: PageKey): PageDecoration {
  return { page_key: pageKey, background_image_url: null, elements: [] }
}

function newElement(type: DecorElementType): PageDecorationElement {
  const base = { id: crypto.randomUUID(), type, opacity: 1, speed: 1 }
  if (type === 'smoke') return { ...base, x: 82, y: 30, width: 10, height: 25, blur: 8, count: 3 }
  return { ...base, x: 50, y: 68, width: 133, height: 200, blur: 2, count: 40 }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

type RangeField = { key: 'blur' | 'count' | 'width' | 'height' | 'speed'; label: string; min: number; max: number; step: number; suffix?: string }

const SMOKE_FIELDS: RangeField[] = [
  { key: 'blur', label: 'Blur', min: 0, max: 20, step: 0.5, suffix: 'px' },
  { key: 'count', label: 'Fumaças', min: 1, max: 15, step: 1 },
  { key: 'width', label: 'Largura', min: 2, max: 40, step: 1, suffix: 'px' },
  { key: 'height', label: 'Altura', min: 5, max: 60, step: 1, suffix: 'px' },
  { key: 'speed', label: 'Velocidade', min: 0.2, max: 3, step: 0.1, suffix: 'x' },
]
const FIRE_FIELDS: RangeField[] = [
  { key: 'blur', label: 'Blur', min: 0, max: 15, step: 0.5, suffix: 'px' },
  { key: 'count', label: 'Bolinhas', min: 1, max: 96, step: 1 },
  { key: 'width', label: 'Largura', min: 50, max: 320, step: 1, suffix: 'px' },
  { key: 'height', label: 'Altura', min: 80, max: 420, step: 1, suffix: 'px' },
  { key: 'speed', label: 'Velocidade', min: 0.2, max: 3, step: 0.1, suffix: 'x' },
]

export default function AdminLayoutCliente() {
  const [pageKey, setPageKey] = useState<PageKey>('catalogo')
  const [byPage, setByPage] = useState<Partial<Record<PageKey, PageDecoration>>>({})
  const [loading, setLoading] = useState(true)
  const [bgUploading, setBgUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [selectedElId, setSelectedElId] = useState<string | null>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const draggingId = useRef<string | null>(null)

  useEffect(() => {
    api.pageDecorations
      .list()
      .then((all) => {
        const map: Partial<Record<PageKey, PageDecoration>> = {}
        for (const d of all) map[d.page_key] = d
        setByPage(map)
      })
      .finally(() => setLoading(false))
  }, [])

  const current = byPage[pageKey] ?? emptyDecoration(pageKey)
  const selectedEl = current.elements.find((e) => e.id === selectedElId) ?? null

  const updateCurrent = (patch: Partial<PageDecoration>) => {
    setByPage((prev) => ({ ...prev, [pageKey]: { ...current, ...patch } }))
    setSaved(false)
  }

  const switchPage = (key: PageKey) => {
    setPageKey(key)
    setSelectedElId(null)
    setError(null)
    setSaved(false)
  }

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (file.size > MAX_BG_MB * 1024 * 1024) {
      setError(`O arquivo tem ${(file.size / (1024 * 1024)).toFixed(1)}MB — o máximo é ${MAX_BG_MB}MB.`)
      return
    }
    setBgUploading(true)
    try {
      const { url } = await api.admin.products.uploadImage(file)
      updateCurrent({ background_image_url: url })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar a imagem.')
    } finally {
      setBgUploading(false)
    }
  }

  const addElement = (type: DecorElementType) => {
    const el = newElement(type)
    updateCurrent({ elements: [...current.elements, el] })
    setSelectedElId(el.id)
  }

  const removeElement = (id: string) => {
    updateCurrent({ elements: current.elements.filter((e) => e.id !== id) })
    if (selectedElId === id) setSelectedElId(null)
  }

  const patchElement = (id: string, patch: Partial<PageDecorationElement>) => {
    setByPage((prev) => {
      const c = prev[pageKey] ?? emptyDecoration(pageKey)
      return { ...prev, [pageKey]: { ...c, elements: c.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) } }
    })
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const result = await api.admin.pageDecorations.save(pageKey, current.background_image_url, current.elements)
      setByPage((prev) => ({ ...prev, [pageKey]: result }))
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o layout.')
    } finally {
      setSaving(false)
    }
  }

  const pinPointerDown = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    draggingId.current = id
    setSelectedElId(id)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const pinPointerMove = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingId.current !== id || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100)
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)
    patchElement(id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
  }
  const pinPointerUp = () => {
    draggingId.current = null
  }

  const activeTab = PAGE_TABS.find((t) => t.key === pageKey)!

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Layout das páginas do cliente</h1>
      </div>
      <p className="text-son-silver-dim text-sm mb-4">
        Escolha a página, envie uma imagem de fundo e adicione fumaça/fogo — arraste o elemento no preview pra posicionar; ele
        renderiza no mesmo lugar proporcional na página de verdade.
      </p>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6">
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchPage(t.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              pageKey === t.key ? 'sunset-bg text-white' : 'bg-son-surface border border-white/5 text-son-silver-dim hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative rounded-2xl border border-white/10 overflow-hidden"
              style={{ width: PREVIEW_W * PREVIEW_SCALE, height: PREVIEW_H * PREVIEW_SCALE, background: '#000' }}
            >
              <div
                ref={previewRef}
                className="relative"
                style={{ width: PREVIEW_W, height: PREVIEW_H, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}
              >
                <iframe
                  src={activeTab.path}
                  title={`Preview ${activeTab.label}`}
                  className="absolute inset-0 w-full h-full border-0"
                  style={{ pointerEvents: 'none' }}
                />
                {current.elements.map((el) => (
                  <div
                    key={el.id}
                    onPointerDown={pinPointerDown(el.id)}
                    onPointerMove={pinPointerMove(el.id)}
                    onPointerUp={pinPointerUp}
                    className={`absolute w-9 h-9 -ml-[18px] -mt-[18px] rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing border-2 ${
                      selectedElId === el.id ? 'border-son-gold' : 'border-white/40'
                    } ${el.type === 'smoke' ? 'bg-slate-500/70' : 'bg-orange-600/70'}`}
                    style={{ left: `${el.x}%`, top: `${el.y}%`, touchAction: 'none' }}
                  >
                    {el.type === 'smoke' ? <Wind className="w-4 h-4 text-white" /> : <Flame className="w-4 h-4 text-white" />}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-son-silver-dim text-center max-w-[280px]">
              Preview em tamanho de celular (390×760). Arraste os círculos pra posicionar — a imagem de fundo mostrada é a
              última salva.
            </p>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="font-bold text-white mb-1">Imagem de fundo</p>
              <p className="text-xs text-son-silver-dim mb-3">Fica atrás do conteúdo da página, cobrindo a tela toda.</p>
              <input
                ref={bgInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleBgChange}
              />
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl bg-son-surface-light flex items-center justify-center overflow-hidden flex-shrink-0">
                  {bgUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-son-silver-dim" />
                  ) : current.background_image_url ? (
                    <img src={current.background_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-son-silver-dim/40" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => bgInputRef.current?.click()}
                    disabled={bgUploading}
                    className="btn-secondary text-sm py-2 px-3"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    {current.background_image_url ? 'Trocar imagem' : 'Enviar imagem'}
                  </button>
                  {current.background_image_url && (
                    <button
                      type="button"
                      onClick={() => updateCurrent({ background_image_url: null })}
                      className="text-xs text-son-silver-dim hover:text-son-pink"
                    >
                      Remover imagem
                    </button>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <p className="font-bold text-white mb-3">Elementos decorativos</p>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => addElement('smoke')} className="btn-secondary text-sm py-2 px-3">
                  <Plus className="w-3.5 h-3.5" />
                  <Wind className="w-3.5 h-3.5" /> Adicionar fumaça
                </button>
                <button type="button" onClick={() => addElement('fire')} className="btn-secondary text-sm py-2 px-3">
                  <Plus className="w-3.5 h-3.5" />
                  <Flame className="w-3.5 h-3.5" /> Adicionar fogo
                </button>
              </div>
              {current.elements.length === 0 ? (
                <p className="text-xs text-son-silver-dim">Nenhum elemento nessa página ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {current.elements.map((el) => (
                    <li key={el.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedElId(el.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left ${
                          selectedElId === el.id ? 'bg-son-gold/10 border border-son-gold text-white' : 'bg-son-surface-light border border-transparent text-son-silver-dim hover:text-white'
                        }`}
                      >
                        {el.type === 'smoke' ? <Wind className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                        {el.type === 'smoke' ? 'Fumaça' : 'Fogo'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {selectedEl && (
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    {selectedEl.type === 'smoke' ? <Wind className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                    {selectedEl.type === 'smoke' ? 'Fumaça' : 'Fogo'} selecionado
                  </p>
                  <button type="button" onClick={() => removeElement(selectedEl.id)} className="text-son-silver-dim hover:text-son-pink">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {(selectedEl.type === 'smoke' ? SMOKE_FIELDS : FIRE_FIELDS).map((f) => (
                  <div key={f.key}>
                    <label className="label">
                      {f.label} — {selectedEl[f.key]}
                      {f.suffix ?? ''}
                    </label>
                    <input
                      type="range"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={selectedEl[f.key]}
                      onChange={(e) => patchElement(selectedEl.id, { [f.key]: parseFloat(e.target.value) } as Partial<PageDecorationElement>)}
                      className="w-full accent-son-pink"
                    />
                  </div>
                ))}
                <div>
                  <label className="label">Opacidade — {Math.round(selectedEl.opacity * 100)}%</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(selectedEl.opacity * 100)}
                    onChange={(e) => patchElement(selectedEl.id, { opacity: parseInt(e.target.value, 10) / 100 })}
                    className="w-full accent-son-pink"
                  />
                </div>
              </Card>
            )}

            {error && <p className="error-msg">{error}</p>}
            <button onClick={save} disabled={saving} className="btn-primary text-sm py-2.5 px-4">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar layout
            </button>
            {saved && <p className="text-green-500 text-sm">Layout salvo — já vale pra todo mundo.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
