/**
 * EcoAgadir - Client API (auth, users, camions, planning, tracking, stats)
 * Toujours /api : en dev Vite proxy vers localhost:5000 (même origine → pas de CORS).
 */
const API_BASE = '/api'

const TOKEN_KEY = 'ecoagadir_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function clearSession() {
  setToken(null)
  localStorage.removeItem('ecoagadir_user')
}

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  const token = getToken()
  if (token) opts.headers['Authorization'] = 'Bearer ' + token
  if (body && method !== 'GET') opts.body = JSON.stringify(body)
  const res = await fetch(API_BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) clearSession()
    throw new Error(data.error || res.statusText || 'Erreur réseau')
  }
  return data
}

export const ecoAgadirApi = {
  getToken,
  setToken,
  clearSession,
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),

  auth: {
    login: (email, password) =>
      request('POST', '/auth/login', { email, password }).then((data) => {
        setToken(data.token)
        if (data.user) localStorage.setItem('ecoagadir_user', JSON.stringify(data.user))
        return { redirect: data.redirect, user: data.user }
      }),
    me: () => request('GET', '/auth/me'),
  },
  users: {
    list: (params) => request('GET', '/users' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request('GET', '/users/' + id),
    create: (data) => request('POST', '/users', data),
    update: (id, data) => request('PUT', '/users/' + id, data),
    delete: (id) => request('DELETE', '/users/' + id),
  },
  camions: {
    list: (params) => request('GET', '/camions' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request('GET', '/camions/' + id),
    create: (data) => request('POST', '/camions', data),
    update: (id, data) => request('PUT', '/camions/' + id, data),
    delete: (id) => request('DELETE', '/camions/' + id),
  },
  depot: {
    get: () => request('GET', '/depot'),
    update: (data) => request('PUT', '/depot', data),
  },
  points: {
    list: (params) => request('GET', '/points' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request('GET', '/points/' + id),
    create: (data) => request('POST', '/points', data),
    update: (id, data) => request('PUT', '/points/' + id, data),
    delete: (id) => request('DELETE', '/points/' + id),
  },
  dechetteries: {
    list: () => request('GET', '/dechetteries'),
    get: (id) => request('GET', '/dechetteries/' + id),
    create: (data) => request('POST', '/dechetteries', data),
    update: (id, data) => request('PUT', '/dechetteries/' + id, data),
    delete: (id) => request('DELETE', '/dechetteries/' + id),
  },
  planning: {
    list: (params) => request('GET', '/planning' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request('GET', '/planning/' + id),
    create: (data) => request('POST', '/planning', data),
    update: (id, data) => request('PUT', '/planning/' + id, data),
    marquerCollecte: (planningId, pointId, poids) =>
      request('POST', '/planning/' + planningId + '/marquer-collecte', {
        point_id: pointId,
        poids_collecte: poids,
      }),
    delete: (id) => request('DELETE', '/planning/' + id),
  },
  tracking: {
    savePosition: (planningId, lat, lng, vitesse) =>
      request('POST', '/tracking/position', { planning_id: planningId, lat, lng, vitesse }),
    positions: (planningId) => request('GET', '/tracking/positions/' + planningId),
    live: () => request('GET', '/tracking/live'),
    pointComplete: (planningId, pointId) =>
      request('POST', '/tracking/point-complete', { planning_id: planningId, point_id: pointId }),
  },
  stats: {
    dashboard: () => request('GET', '/stats/dashboard'),
    journalieres: (jours) => request('GET', '/stats/journalieres?jours=' + (jours || 30)),
    classementChauffeurs: (jours) =>
      request('GET', '/stats/classement-chauffeurs?jours=' + (jours || 30)),
  },
}
