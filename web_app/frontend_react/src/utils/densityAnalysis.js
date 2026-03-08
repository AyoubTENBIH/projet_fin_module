/**
 * Analyse de densité des points de collecte (bennes).
 * Méthode : distance moyenne aux 3 plus proches voisins (Haversine),
 * classification zone dense / normale / isolée, détection des bennes redondantes.
 */

/** Rayon terrestre en mètres (WGS84) */
const R = 6371000

/**
 * Distance Haversine entre deux points GPS (lat, lng) en mètres.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Pour chaque point, calcule la distance moyenne vers ses 3 plus proches voisins.
 * Retourne Map(pointId -> { avgDist3NN, distancesToNeighbors }).
 */
function computeDensityByPoint(collectionPoints) {
  const byId = new Map()
  const pts = collectionPoints.filter(
    (p) => p.lat != null && p.lng != null && !p.isDepot
  )
  for (const p of pts) {
    const distances = pts
      .filter((q) => q.id !== p.id)
      .map((q) => ({
        id: q.id,
        dist: haversineMeters(p.lat, p.lng, q.lat, q.lng),
      }))
    distances.sort((a, b) => a.dist - b.dist)
    const top3 = distances.slice(0, 3)
    const avgDist3NN =
      top3.length > 0
        ? top3.reduce((s, d) => s + d.dist, 0) / top3.length
        : Infinity
    byId.set(p.id, {
      point: p,
      avgDist3NN,
      neighbors: top3,
    })
  }
  return byId
}

/** Catégories de densité (seuils en mètres) */
const DENSE_MAX = 100
const NORMAL_MAX = 400

/**
 * Classifie chaque point : dense (< 100m), normal (100–400m), isolé (> 400m).
 */
function classifyByDensity(byId) {
  for (const [, data] of byId) {
    if (data.avgDist3NN < DENSE_MAX) data.category = 'dense'
    else if (data.avgDist3NN <= NORMAL_MAX) data.category = 'normal'
    else data.category = 'isolated'
  }
}

/**
 * Dans les zones denses, regroupe les bennes à moins de proximityThreshold m.
 * Dans chaque groupe, garde celle qui a le plus grand volume, les autres sont candidates.
 *
 * proximityThreshold en mètres (ex. 80 ou valeur du slider 50–300).
 */
function computeCandidates(byId, proximityThreshold) {
  const densePoints = [...byId.values()].filter((d) => d.category === 'dense')
  const visited = new Set()
  const candidates = []

  for (const data of densePoints) {
    const p = data.point
    if (visited.has(p.id)) continue
    const cluster = [p]
    const queue = [p]
    visited.add(p.id)
    while (queue.length) {
      const cur = queue.shift()
      for (const other of densePoints) {
        if (visited.has(other.point.id)) continue
        const d = haversineMeters(
          cur.lat,
          cur.lng,
          other.point.lat,
          other.point.lng
        )
        if (d < proximityThreshold) {
          visited.add(other.point.id)
          cluster.push(other.point)
          queue.push(other.point)
        }
      }
    }
    if (cluster.length < 2) continue
    cluster.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0) || a.id - b.id)
    const reference = cluster[0]
    for (let i = 1; i < cluster.length; i++) {
      const c = cluster[i]
      candidates.push({
        id: c.id,
        nom: c.nom || `Point ${c.id}`,
        volume: c.volume ?? 0,
        referenceId: reference.id,
        distanceToReference: Math.round(
          haversineMeters(c.lat, c.lng, reference.lat, reference.lng)
        ),
      })
    }
  }

  return candidates
}

/**
 * Lance l'analyse complète.
 *
 * @param {Array} points - Tous les points (dont dépôt à exclure)
 * @param {number} proximityThreshold - Seuil de proximité en m (50–300), en dessous duquel une benne peut être considérée redondante
 * @returns {{
 *   byPointId: Record<number, { category: string, candidate: boolean, referenceId?: number }>,
 *   candidates: Array<{ id, nom, volume, referenceId, distanceToReference }>,
 *   totalAnalyzed: number,
 *   totalVolumeToLose: number
 * }}
 */
export function analyzeDensity(points, proximityThreshold = 100) {
  const collectionPoints = (points || []).filter(
    (p) => p.lat != null && p.lng != null && !p.isDepot
  )
  const byId = computeDensityByPoint(collectionPoints)
  classifyByDensity(byId)
  const candidates = computeCandidates(byId, proximityThreshold)
  const candidateIds = new Set(candidates.map((c) => c.id))

  const byPointId = {}
  for (const [id, data] of byId) {
    const isCandidate = candidateIds.has(id)
    const ref = candidates.find((c) => c.id === id)
    byPointId[id] = {
      category: data.category,
      candidate: isCandidate,
      referenceId: ref?.referenceId ?? null,
      avgDist3NN: data.avgDist3NN,
    }
  }

  const totalVolumeToLose = candidates.reduce((s, c) => s + c.volume, 0)

  return {
    byPointId,
    candidates,
    totalAnalyzed: collectionPoints.length,
    totalVolumeToLose,
  }
}
