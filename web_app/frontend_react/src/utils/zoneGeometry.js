/**
 * Géométrie des zones : enveloppe convexe (Graham Scan) + buffer.
 * Coordonnées en [lat, lng] pour Leaflet.
 */

/**
 * Cross product / orientation pour Graham Scan.
 * > 0 si CCW, < 0 si CW, 0 si colinéaire.
 */
function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function distSq(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

/**
 * Graham Scan : enveloppe convexe d'un ensemble de points [lat, lng].
 * Retourne les sommets du polygone dans l'ordre (sens trigo).
 */
export function convexHull(points) {
  if (!points || points.length < 3) return points ? [...points] : []
  const pts = points.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [p.lat, p.lng]))
  const n = pts.length

  // Point le plus bas (puis le plus à gauche)
  let start = 0
  for (let i = 1; i < n; i++) {
    if (pts[i][1] < pts[start][1] || (pts[i][1] === pts[start][1] && pts[i][0] < pts[start][0])) {
      start = i
    }
  }
  const pivot = pts[start]

  const sorted = pts
    .map((p, i) => ({ p, i }))
    .filter((_, i) => i !== start)
    .sort((a, b) => {
      const c = cross(pivot, a.p, b.p)
      if (c !== 0) return -c
      return distSq(pivot, a.p) - distSq(pivot, b.p)
    })
    .map((x) => x.p)

  const hull = [pivot, sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    let top = hull[hull.length - 1]
    let next = sorted[i]
    while (hull.length >= 2 && cross(hull[hull.length - 2], top, next) <= 0) {
      hull.pop()
      top = hull[hull.length - 1]
    }
    hull.push(next)
  }
  return hull
}

/**
 * Normale extérieure au segment [prev, curr] (vers la gauche du segment).
 * En (lat, lng), "gauche" = sens trigo = (-dy, dx) normalisé.
 */
function outwardNormal(prev, curr) {
  const dx = curr[0] - prev[0]
  const dy = curr[1] - prev[1]
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return [-dy / len, dx / len]
}

/**
 * Applique un buffer (expansion) au polygone en déplaçant chaque sommet
 * le long de la bissectrice extérieure. bufferDeg ~ 0.004 pour ~400 m à Casablanca.
 * @param {number[][]} polygon - [[lat, lng], ...]
 * @param {number} bufferDeg - distance en degrés (~0.004 pour 300–500 m)
 */
export function bufferPolygon(polygon, bufferDeg = 0.004) {
  if (!polygon || polygon.length < 3) return polygon
  const n = polygon.length
  const result = []
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n]
    const curr = polygon[i]
    const next = polygon[(i + 1) % n]
    const n1 = outwardNormal(prev, curr)
    const n2 = outwardNormal(curr, next)
    const bisect = [n1[0] + n2[0], n1[1] + n2[1]]
    const len = Math.sqrt(bisect[0] * bisect[0] + bisect[1] * bisect[1]) || 1
    const ux = bisect[0] / len
    const uy = bisect[1] / len
    result.push([curr[0] + bufferDeg * ux, curr[1] + bufferDeg * uy])
  }
  return result
}

/**
 * Centre géographique (centroïde) d'une liste de points.
 */
export function centroid(points) {
  if (!points || points.length === 0) return null
  const pts = points.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [p.lat, p.lng]))
  let lat = 0
  let lng = 0
  for (const p of pts) {
    lat += p[0]
    lng += p[1]
  }
  return [lat / pts.length, lng / pts.length]
}

/**
 * Construit un polygone de zone englobant tous les points fournis.
 * - 0 point  → null
 * - 1 point  → petit carré autour du point
 * - 2 points → rectangle englobant les deux points
 * - 3+ points → enveloppe convexe + buffer vers l'extérieur
 *
 * @param {Array<{lat:number,lng:number}>} points
 * @param {number} bufferDeg ~0.003–0.005 (Casablanca ≈ 300–500 m)
 * @returns {number[][] | null} Tableau de [lat, lng] pour Leaflet
 */
export function buildZonePolygonFromPoints(points, bufferDeg = 0.004) {
  if (!points || points.length === 0) return null
  const coords = points.map((p) =>
    Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p.lat), Number(p.lng)]
  )

  if (coords.length === 1) {
    const [lat, lng] = coords[0]
    const d = bufferDeg
    return [
      [lat - d, lng - d],
      [lat - d, lng + d],
      [lat + d, lng + d],
      [lat + d, lng - d],
    ]
  }

  if (coords.length === 2) {
    const [a, b] = coords
    const minLat = Math.min(a[0], b[0]) - bufferDeg
    const maxLat = Math.max(a[0], b[0]) + bufferDeg
    const minLng = Math.min(a[1], b[1]) - bufferDeg
    const maxLng = Math.max(a[1], b[1]) + bufferDeg
    return [
      [minLat, minLng],
      [minLat, maxLng],
      [maxLat, maxLng],
      [maxLat, minLng],
    ]
  }

  // 3 points ou plus : enveloppe convexe puis légère expansion radiale autour du centroïde
  const hull = convexHull(coords)
  if (!hull || hull.length < 3) {
    // Fallback bounding box si jamais l'enveloppe échoue
    const lats = coords.map((c) => c[0])
    const lngs = coords.map((c) => c[1])
    const minLat = Math.min(...lats) - bufferDeg
    const maxLat = Math.max(...lats) + bufferDeg
    const minLng = Math.min(...lngs) - bufferDeg
    const maxLng = Math.max(...lngs) + bufferDeg
    return [
      [minLat, minLng],
      [minLat, maxLng],
      [maxLat, maxLng],
      [maxLat, minLng],
    ]
  }

  const center = centroid(hull.map(([lat, lng]) => ({ lat, lng })))
  if (!center) return hull
  const [cLat, cLng] = center
  const expanded = hull.map(([lat, lng]) => {
    const dx = lat - cLat
    const dy = lng - cLng
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / len
    const uy = dy / len
    return [lat + bufferDeg * ux, lng + bufferDeg * uy]
  })
  return expanded
}
