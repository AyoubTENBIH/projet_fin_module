import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { redirect } = await login(email.trim(), password)
      navigate(redirect || '/admin/dashboard')
    } catch (err) {
      setError(err.message || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{
        background: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1920) center/cover',
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white/95 backdrop-blur-xl shadow-2xl p-8">
        <div className="text-center text-2xl font-bold text-[var(--primary)] mb-2">
          🌿 EcoAgadir
        </div>
        <p className="text-center text-[var(--color-text-muted)] mb-6">
          Gestion des collectes de déchets
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="admin@ecoagadir.ma"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-70 transition"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
          Démo : admin@ecoagadir.ma / Admin2024! &nbsp;|&nbsp; y.benali@ecoagadir.ma / Chauffeur1!
        </p>
      </div>
    </div>
  )
}
