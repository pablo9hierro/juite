import { useEffect, useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { api, ApiError } from '../../lib/api'

export default function AdminFrete() {
  const [pricePerKm, setPricePerKm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.shippingSettings.get().then((settings) => {
      setPricePerKm(String(settings.price_per_km))
      setLoading(false)
    })
  }, [])

  const save = async () => {
    const value = Number(pricePerKm)
    if (Number.isNaN(value) || value < 0) return
    setError(null)
    setSaving(true)
    try {
      const updated = await api.admin.shippingSettings.update(value)
      setPricePerKm(String(updated.price_per_km))
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar o frete.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-black mb-2">Frete</h1>
      <p className="text-sm text-son-silver-dim mb-6">
        O frete é calculado pela distância entre a tabacaria e o endereço que o cliente ajustar no
        mapa do checkout. Defina aqui só o preço por quilômetro.
      </p>

      {error && <p className="error-msg mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-son-surface border border-white/5 rounded-2xl px-4 py-3 max-w-sm">
          <span className="flex-1 text-sm text-white">R$ por km</span>
          <input
            className="input-field w-28 flex-none py-2 text-sm"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={pricePerKm}
            onChange={(e) => setPricePerKm(e.target.value)}
          />
          <button
            onClick={save}
            disabled={saving || pricePerKm === ''}
            className="w-9 h-9 flex-none flex items-center justify-center rounded-xl text-son-silver-dim hover:text-son-pink hover:bg-white/5 disabled:opacity-40 transition-colors"
            aria-label="Salvar preço por km"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Save className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
