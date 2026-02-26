import { Navigate, useRoutes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import AdminLayout from './components/layout/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Carte from './pages/admin/Carte'
import Chauffeurs from './pages/admin/Chauffeurs'
import Planning from './pages/admin/Planning'
import Suivi from './pages/admin/Suivi'
import Statistiques from './pages/admin/Statistiques'
import ChauffeurInterface from './pages/chauffeur/ChauffeurInterface'

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-main)]">
        <div className="text-[var(--color-text-muted)]">Chargement...</div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />
  }
  if (role === 'admin' && user.role !== 'admin') {
    return <Navigate to="/chauffeur" replace />
  }
  if (role === 'chauffeur' && user.role !== 'chauffeur') {
    return <Navigate to="/admin/dashboard" replace />
  }
  return children
}

function RedirectIfLoggedIn({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/chauffeur'} replace />
  }
  return children
}

const routes = [
  {
    path: '/',
    element: (
      <RedirectIfLoggedIn>
        <Login />
      </RedirectIfLoggedIn>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAuth role="admin">
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'carte', element: <Carte /> },
      { path: 'chauffeurs', element: <Chauffeurs /> },
      { path: 'planning', element: <Planning /> },
      { path: 'suivi', element: <Suivi /> },
      { path: 'statistiques', element: <Statistiques /> },
    ],
  },
  {
    path: '/chauffeur',
    element: (
      <RequireAuth role="chauffeur">
        <ChauffeurInterface />
      </RequireAuth>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

function AppRoutes() {
  return useRoutes(routes)
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
