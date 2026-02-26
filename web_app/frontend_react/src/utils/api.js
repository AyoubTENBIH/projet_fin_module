/**
 * API VillePropre - Appels aux endpoints Flask
 */

// Toujours utiliser /api : en dev Vite proxy vers localhost:5000 (évite CORS / "Failed to fetch")
const API_BASE = '/api'

// Convertir lat/lng (Casablanca) en coordonnées x,y pour le graphe
function latLngToXY(lat, lng) {
  const centerLat = 33.5731
  const centerLng = -7.5898
  // ~111km par degré lat, ~85km par degré lng à Casablanca
  const x = (lng - centerLng) * 85000
  const y = (lat - centerLat) * 111000
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }
}

export function prepareDataForApi(points, camions, depotPoint, dechetteries = []) {
  const depot = depotPoint || points[0]
  if (!depot || !points?.length) return null

  const depotXY = depot.lat != null ? latLngToXY(depot.lat, depot.lng) : { x: depot.x || 0, y: depot.y || 0 }
  const depotId = depot.id
  const collectionPoints = points.filter(
    (p) => (depotId != null ? p.id !== depotId : p.id !== depot?.id) && !p.isDepot
  )

  const ptsApi = [
    { id: 0, x: depotXY.x, y: depotXY.y, nom: depot.nom || 'Dépôt' },
    ...collectionPoints
    .map((p) => {
        const xy = p.lat != null ? latLngToXY(p.lat, p.lng) : { x: p.x || 0, y: p.y || 0 }
        return { id: p.id, x: xy.x, y: xy.y, nom: p.nom || `Point ${p.id}` }
      }),
  ]

  const ids = ptsApi.map((p) => p.id)
  const connexions = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      if (i !== j) connexions.push({ depart: ids[i], arrivee: ids[j], distance: null })
    }
  }

  const dechetteriesApi = (dechetteries || []).map((d) => {
    const xy = d.lat != null ? latLngToXY(d.lat, d.lng) : { x: d.x || 0, y: d.y || 0 }
    return {
      id: d.id,
      x: xy.x,
      y: xy.y,
      nom: d.nom || `Déchetterie ${d.id}`,
      capacite_max: d.capacite_max || 0,
      types_dechets: d.types_dechets || [],
    }
  })

  const zones = ptsApi
    .filter((p) => p.id !== 0)
    .map((p) => {
      const orig = points.find((pt) => pt.id === p.id)
      return {
        id: p.id,
        points: [p.id],
        volume_moyen: orig?.volume || 1000,
        centre: { x: p.x, y: p.y },
        priorite: orig?.priorite || 'normale',
      }
    })

  return {
    points: ptsApi,
    depot: { id: 0, ...depotXY, nom: depot.nom || 'Dépôt' },
    connexions,
    dechetteries: dechetteriesApi,
    camions: (camions || []).map((c) => ({
      id: c.id,
      capacite: c.capacite,
      cout_fixe: c.cout_fixe,
      zones_accessibles: c.zones_accessibles || [],
    })),
    zones,
  }
}

export async function apiNiveau1(points, connexions, dechetteries = []) {
  const res = await fetch(`${API_BASE}/niveau1/calculer-distances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points, connexions, dechetteries }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Niveau 1: ${res.status}`)
  }
  return res.json()
}

export async function apiNiveau2(data) {
  const res = await fetch(`${API_BASE}/niveau2/optimiser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Niveau 2: ${res.status}`)
  }
  return res.json()
}

export function xyToLatLng(x, y) {
  const centerLat = 33.5731
  const centerLng = -7.5898
  const lat = centerLat + y / 111000
  const lng = centerLng + x / 85000
  return { lat, lng }
}

/** Cache OSRM pour éviter requêtes répétées (même approche que web_app/frontend map.js) */
const osrmCache = new Map()
const OSRM_DEBUG = true
function _osrmDebug(msg, ...args) {
  if (OSRM_DEBUG && typeof console !== 'undefined') console.log('[OSRM Frontend]', msg, ...args)
}

/**
 * Appel OSRM Route API - MÊME APPROCHE que web_app/frontend map.js getFullRoute()
 * Format: route/v1/driving/{lng1},{lat1};{lng2},{lat2};...?overview=full&geometries=geojson
 * @param {Array<{lat: number, lng: number}>} pointsArray
 * @returns {Promise<{coordinates: Array<[lat,lng]>, totalDistance: number|null, totalDuration: number|null}>}
 */
export async function getOsrmRoute(pointsArray) {
  if (!pointsArray?.length) {
    return { coordinates: [], totalDistance: 0, totalDuration: 0 }
  }
  if (pointsArray.length === 1) {
    return {
      coordinates: [[pointsArray[0].lat, pointsArray[0].lng]],
      totalDistance: 0,
      totalDuration: 0,
    }
  }

  const cacheKey = pointsArray.map((p) => `${p.lat},${p.lng}`).join('→')
  if (osrmCache.has(cacheKey)) {
    _osrmDebug('Cache hit:', cacheKey.slice(0, 80) + '...')
    return osrmCache.get(cacheKey)
  }

  const waypoints = pointsArray.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
  _osrmDebug('Route API:', pointsArray.length, 'waypoints, URL len=', url.length)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    _osrmDebug('Response:', response.status, response.statusText)
    if (!response.ok) throw new Error(`OSRM API error: ${response.status}`)
    const data = await response.json()
    if (!data.routes?.length) throw new Error('No route found')

    const route = data.routes[0]
    const coordinates = route.geometry.coordinates.map((c) => [c[1], c[0]])
    const result = {
      coordinates,
      totalDistance: route.distance / 1000,
      totalDuration: route.duration / 60,
    }
    osrmCache.set(cacheKey, result)
    _osrmDebug('OK:', result.coordinates?.length, 'points,', result.totalDistance?.toFixed(2), 'km')
    return result
  } catch (err) {
    if (err.name === 'AbortError') {
      _osrmDebug('Timeout 15s - fallback lignes droites')
    } else {
      _osrmDebug('Erreur:', err?.message)
    }
    const coordinates = pointsArray.map((p) => [p.lat, p.lng])
    return { coordinates, totalDistance: null, totalDuration: null }
  }
}

export async function apiRoutesOptimiser(depot, points, dechetteries, camions, useOsm = false) {
  console.log('[API] apiRoutesOptimiser: preparing data, depot=', depot?.id, 'points=', points?.length, 'use_osrm=', useOsm)
  const data = prepareDataForApi(points, camions, depot, dechetteries)
  if (!data) throw new Error('Données insuffisantes pour les routes')
  const pointsForRoutes = data.points.filter((p) => p.id !== 0).map((p) => {
    const orig = points.find((pt) => pt.id === p.id)
    return { ...p, volume: orig?.volume || 1000 }
  })
  
  const payload = {
    depot: data.depot,
    points: pointsForRoutes,
    dechetteries: data.dechetteries,
    camions: data.camions,
    use_osrm: useOsm,
  }
  const url = `${API_BASE}/routes/optimiser`
  console.log('[API] apiRoutesOptimiser: sending POST', url, 'payload:', {
    depot: payload.depot?.id,
    points: payload.points?.length,
    dechetteries: payload.dechetteries?.length,
    camions: payload.camions?.length,
    use_osrm: payload.use_osrm,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error('[API] apiRoutesOptimiser: timeout 90s - abandon')
    controller.abort()
  }, 90000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    console.log('[API] apiRoutesOptimiser: response status=', res.status, res.statusText)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Routes: ${res.status}`)
    }
    const result = await res.json()
    console.log('[API] apiRoutesOptimiser: result OK, routes=', result?.routes?.length)
    return result
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Timeout 90s - le backend ne répond pas. Vérifiez que Flask tourne sur le port 5000.')
    }
    throw err
  }
}

export async function apiNiveau3(data) {
  const res = await fetch(`${API_BASE}/niveau3/generer_planning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Niveau 3: ${res.status}`)
  }
  return res.json()
}
