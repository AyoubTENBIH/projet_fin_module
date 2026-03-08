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

export function prepareDataForApi(points, camions, depotPoint, dechetteries = [], zonesDef = []) {
  const depot = depotPoint || points[0]
  if (!depot || !points?.length) return null

  const depotXY = depot.lat != null ? latLngToXY(depot.lat, depot.lng) : { x: depot.x || 0, y: depot.y || 0 }
  const depotId = depot.id
  const collectionPoints = points.filter(
    (p) => (depotId != null ? p.id !== depotId : p.id !== depot?.id) && !p.isDepot
  )

  const ptsApi = [
    { id: 0, x: depotXY.x, y: depotXY.y, nom: depot.nom || 'Dépôt' },
    ...collectionPoints.map((p) => {
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

  let zones
  if (zonesDef && zonesDef.length > 0) {
    zones = zonesDef.map((z) => {
      const pointIds = z.point_ids || z.points || []
      const zonePts = points.filter((p) => pointIds.includes(p.id))
      const volume = zonePts.reduce((s, p) => s + (p.volume ?? 0), 0)
      const cx = zonePts.length
        ? zonePts.reduce((s, p) => {
            const xy = p.lat != null ? latLngToXY(p.lat, p.lng) : { x: p.x || 0, y: p.y || 0 }
            return s + xy.x
          }, 0) / zonePts.length
        : 0
      const cy = zonePts.length
        ? zonePts.reduce((s, p) => {
            const xy = p.lat != null ? latLngToXY(p.lat, p.lng) : { x: p.x || 0, y: p.y || 0 }
            return s + xy.y
          }, 0) / zonePts.length
        : 0
      return {
        id: z.id,
        points: pointIds,
        volume_moyen: volume || 1000,
        centre: { x: cx, y: cy },
        priorite: z.priorite || 'normale',
      }
    })
  } else {
    zones = ptsApi
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
  }

  return {
    points: ptsApi,
    depot: { id: 0, ...depotXY, nom: depot.nom || 'Dépôt' },
    connexions,
    dechetteries: dechetteriesApi,
    camions: (camions || []).map((c) => ({
      id: c.id,
      capacite: c.capacite,
      cout_fixe: c.cout_fixe,
      zones_accessibles: c.zones_assignees ?? c.zones_accessibles ?? [],
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
/** Nombre max de waypoints par requête OSRM (limite API ~100, URL longue ; 25 = fiable et rapide) */
const MAX_OSRM_WAYPOINTS_PER_REQUEST = 25
/** Délai minimum entre deux requêtes OSRM (évite 429 Too Many Requests sur le serveur public) */
const OSRM_MIN_DELAY_MS = 1300
/** Timeout par segment (ms) */
const OSRM_SEGMENT_TIMEOUT_MS = 22000
function _osrmDebug(msg, ...args) {
  if (OSRM_DEBUG && typeof console !== 'undefined') console.log('[OSRM Frontend]', msg, ...args)
}

// File d'attente OSRM : une seule requête à la fois + délai pour respecter les limites du serveur public
let osrmLastRequestTime = 0
const osrmQueue = []
let osrmQueueProcessing = false
function processOsrmQueue() {
  if (osrmQueueProcessing || osrmQueue.length === 0) return
  osrmQueueProcessing = true
  const item = osrmQueue.shift()
  const { pointsArray, resolve } = item
  const delay = Math.max(0, OSRM_MIN_DELAY_MS - (Date.now() - osrmLastRequestTime))
  setTimeout(() => {
    osrmLastRequestTime = Date.now()
    doOneOsrmFetch(pointsArray).then(resolve).catch((err) => {
      _osrmDebug('Queue fetch error:', err?.message)
      resolve({
        coordinates: pointsArray.map((p) => [p.lat, p.lng]),
        totalDistance: null,
        totalDuration: null,
      })
    }).finally(() => {
      osrmQueueProcessing = false
      processOsrmQueue()
    })
  }, delay)
}

/**
 * Une seule requête HTTP OSRM (sans cache, sans file). Utilisée par la file pour éviter 429.
 * @private
 */
async function doOneOsrmFetch(pointsArray) {
  if (!pointsArray?.length) return { coordinates: [], totalDistance: 0, totalDuration: 0 }
  if (pointsArray.length === 1) {
    return {
      coordinates: [[pointsArray[0].lat, pointsArray[0].lng]],
      totalDistance: 0,
      totalDuration: 0,
    }
  }
  const waypoints = pointsArray.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), OSRM_SEGMENT_TIMEOUT_MS)
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (response.status === 429) {
        const retryAfter = 4000 + attempt * 2000
        _osrmDebug('429 Too Many Requests, attente', retryAfter / 1000, 's puis retry')
        await new Promise((r) => setTimeout(r, retryAfter))
        continue
      }
      if (!response.ok) throw new Error(`OSRM API error: ${response.status}`)
      const data = await response.json()
      if (!data.routes?.length) throw new Error('No route found')
      const route = data.routes[0]
      const coordinates = route.geometry.coordinates.map((c) => [c[1], c[0]])
      return {
        coordinates,
        totalDistance: route.distance / 1000,
        totalDuration: route.duration / 60,
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        _osrmDebug('Timeout', OSRM_SEGMENT_TIMEOUT_MS / 1000, 's - segment')
      } else {
        _osrmDebug('Erreur segment:', err?.message)
      }
      return {
        coordinates: pointsArray.map((p) => [p.lat, p.lng]),
        totalDistance: null,
        totalDuration: null,
      }
    }
  }
  return {
    coordinates: pointsArray.map((p) => [p.lat, p.lng]),
    totalDistance: null,
    totalDuration: null,
  }
}

/**
 * Appel OSRM Route API pour un seul tronçon, via la file (évite 429).
 * @private
 */
function getOsrmRouteSingleSegment(pointsArray) {
  if (!pointsArray?.length) return Promise.resolve({ coordinates: [], totalDistance: 0, totalDuration: 0 })
  if (pointsArray.length === 1) {
    return Promise.resolve({
      coordinates: [[pointsArray[0].lat, pointsArray[0].lng]],
      totalDistance: 0,
      totalDuration: 0,
    })
  }
  return new Promise((resolve) => {
    osrmQueue.push({ pointsArray, resolve })
    processOsrmQueue()
  })
}

/**
 * Route OSRM pour un grand nombre de waypoints : découpe en tronçons, appelle OSRM par tronçon,
 * concatène les géométries. Évite les échecs (URL trop longue / limite API) tout en gardant le tracé routier.
 */
async function getOsrmRouteSegmented(pointsArray) {
  const max = MAX_OSRM_WAYPOINTS_PER_REQUEST
  const segments = []
  for (let start = 0; start < pointsArray.length; start += max - 1) {
    const end = Math.min(start + max, pointsArray.length)
    segments.push(pointsArray.slice(start, end))
    if (end >= pointsArray.length) break
  }
  _osrmDebug('Route longue:', pointsArray.length, 'waypoints →', segments.length, 'tronçons OSRM')
  const results = []
  for (let i = 0; i < segments.length; i += 2) {
    const batch = segments.slice(i, i + 2).map((seg) => getOsrmRouteSingleSegment(seg))
    results.push(...(await Promise.all(batch)))
  }
  const coordinates = []
  let totalDistance = 0
  let totalDuration = 0
  for (let i = 0; i < results.length; i++) {
    const coords = results[i].coordinates || []
    if (coords.length === 0) continue
    if (i === 0) {
      coordinates.push(...coords)
    } else {
      coordinates.push(...coords.slice(1))
    }
    if (results[i].totalDistance != null) totalDistance += results[i].totalDistance
    if (results[i].totalDuration != null) totalDuration += results[i].totalDuration
  }
  return {
    coordinates: coordinates.length ? coordinates : pointsArray.map((p) => [p.lat, p.lng]),
    totalDistance: totalDistance || null,
    totalDuration: totalDuration || null,
  }
}

/**
 * Appel OSRM Route API - tracé routier réel.
 * Pour les longues routes (> MAX_OSRM_WAYPOINTS_PER_REQUEST), découpe en tronçons puis concatène.
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
    _osrmDebug('Cache hit:', pointsArray.length, 'waypoints')
    return osrmCache.get(cacheKey)
  }

  const useSegmented = pointsArray.length > MAX_OSRM_WAYPOINTS_PER_REQUEST
  const result = useSegmented
    ? await getOsrmRouteSegmented(pointsArray)
    : await getOsrmRouteSingleSegment(pointsArray)

  osrmCache.set(cacheKey, result)
  _osrmDebug('OK:', result.coordinates?.length, 'points,', result.totalDistance != null ? result.totalDistance.toFixed(2) + ' km' : 'n/a')
  return result
}

export async function apiRoutesOptimiser(depot, points, dechetteries, camions, useOsm = false, zones = [], forceNoTimeLimit = false) {
  console.log('[API] apiRoutesOptimiser: preparing data, depot=', depot?.id, 'points=', points?.length, 'zones=', zones?.length, 'use_osrm=', useOsm)
  const data = prepareDataForApi(points, camions, depot, dechetteries, zones)
  if (!data) throw new Error('Données insuffisantes pour les routes')
  const pointsForRoutes = data.points.filter((p) => p.id !== 0).map((p) => {
    const orig = points.find((pt) => pt.id === p.id)
    const pt = { ...p, volume: orig?.volume || 1000 }
    if (orig?.zone_id != null) {
      pt.zone_id = orig.zone_id
    }
    return pt
  })
  
  const payload = {
    depot: data.depot,
    points: pointsForRoutes,
    dechetteries: data.dechetteries,
    camions: data.camions,
    use_osrm: useOsm,
  }
  if (!forceNoTimeLimit && pointsForRoutes.length > 200) {
    payload.time_limit_seconds = Math.min(300, 60 + Math.ceil(pointsForRoutes.length / 50))
  }
  // Debug couverture : activer avec localStorage.setItem('debug_coverage','1') puis relancer l'optimisation
  if (typeof localStorage !== 'undefined' && localStorage.getItem('debug_coverage')) {
    payload.debug_coverage = true
    console.log('[API] apiRoutesOptimiser: debug_coverage=TRUE (logs dans la console du backend)')
  }
  const url = `${API_BASE}/routes/optimiser`
  console.log('[API] apiRoutesOptimiser: sending POST', url, 'points=', pointsForRoutes.length, 'payload:', {
    depot: payload.depot?.id,
    points: payload.points?.length,
    dechetteries: payload.dechetteries?.length,
    camions: payload.camions?.length,
    use_osrm: payload.use_osrm,
    time_limit: payload.time_limit_seconds || 'none',
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
