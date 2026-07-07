import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'

export default function AdminConta() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!newEmail.trim() && !newPassword.trim()) {
      setError('Preencha o novo e-mail e/ou a nova senha.')
      return
    }
    if (newPassword.trim() && newPassword !== confirmPassword) {
      setError('A confirmação não confere com a nova senha.')
      return
    }
    if (newPassword.trim() && newPassword.trim().length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      await api.auth.updateAdminProfile(currentPassword, newEmail.trim() || undefined, newPassword.trim() || undefined)
      setSuccess(true)
      setCurrentPassword('')
      setNewEmail('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar a conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
        <KeyRound className="w-5 h-5" /> Minha conta
      </h1>
      <p className="text-son-silver-dim text-sm mb-6">Troque o e-mail e/ou a senha de login do admin.</p>

      <form onSubmit={handleSubmit} className="max-w-sm bg-son-surface border border-white/5 rounded-2xl p-6 space-y-4">
        <div>
          <label className="label">Senha atual (obrigatória pra confirmar)</label>
          <input
            className="input-field"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Novo e-mail (deixe em branco pra manter)</label>
          <input className="input-field" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Nova senha (deixe em branco pra manter)</label>
          <input
            className="input-field"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
          />
        </div>
        <div>
          <label className="label">Confirmar nova senha</label>
          <input
            className="input-field"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        {success && <p className="text-green-500 text-sm">Dados atualizados com sucesso.</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Salvar
        </button>
      </form>
    </div>
  )
}
