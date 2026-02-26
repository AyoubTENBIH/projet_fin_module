import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const nav = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/carte', label: 'Carte & Planification', icon: '🗺️' },
  { to: '/admin/chauffeurs', label: 'Chauffeurs', icon: '👥' },
  { to: '/admin/planning', label: 'Planning', icon: '📅' },
  { to: '/admin/suivi', label: 'Suivi Temps Réel', icon: '📡' },
  { to: '/admin/statistiques', label: 'Statistiques', icon: '📈' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-64 min-h-screen flex flex-col p-4"
        style={{ background: 'var(--bg-sidebar)', color: 'var(--sidebar-text)' }}
      >
        <div className="text-lg font-bold text-white pb-3 border-b border-white/10 mb-2">
          🌿 EcoAgadir
        </div>
        <nav className="flex flex-col gap-0.5">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2.5 rounded-lg transition ${isActive ? 'bg-[var(--sidebar-active)]/20 text-[var(--sidebar-active)]' : 'hover:bg-white/10'}`
              }
            >
              {icon} {label}
            </NavLink>
          ))}
          <div className="my-2 border-t border-white/10" />
          <button
            onClick={handleLogout}
            className="px-4 py-2.5 rounded-lg text-left hover:bg-white/10 transition"
          >
            🚪 Déconnexion
          </button>
        </nav>
      </aside>
      <main className="flex-1 p-6 bg-[var(--color-bg-main)] overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
