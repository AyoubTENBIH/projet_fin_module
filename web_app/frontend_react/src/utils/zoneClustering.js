// Clustering géographique pondéré par volume pour générer des zones automatiquement.
// Entrée: points = [{ id, lat, lng, volume }]
// Sortie: assignmentsById, centroids, volumes, totalVolume

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function euclid2(a, b) {
  const dx = a.lat - b.lat
  const dy = a.lng - b.lng
  return dx * dx + dy * dy
}

export function clusterPointsIntoZones(points, camions = [], options = {}) {
  const n = Array.isArray(points) ? points.length : 0
  if (!n) return null

  const volumes = points.map((p) => (typeof p.volume === 'number' ? p.volume : 800))
  const totalVolume = volumes.reduce((s, v) => s + (v || 0), 0)

  let k = options.k || camions.length || 3
  k = Math.max(1, Math.min(k, n))

  const maxIterations = options.maxIterations ?? 100
  const tolerance = options.tolerance ?? 1e-4
  const weightByVolume = options.weightByVolume !== false
  const maxVolumePerZone =
    typeof options.maxVolumePerZone === 'number' && options.maxVolumePerZone > 0
      ? options.maxVolumePerZone
      : null
  const maxDistanceKm =
    typeof options.maxDistanceKm === 'number' && options.maxDistanceKm > 0
      ? options.maxDistanceKm
      : null

  const targetVolume = maxVolumePerZone || (totalVolume / k || 1)

  // Initialisation des centroïdes (approx K-Means++ : premier au hasard, suivants les plus éloignés)
  const centroids = []
  const firstIdx = Math.floor(Math.random() * n)
  centroids.push({ lat: points[firstIdx].lat, lng: points[firstIdx].lng })

  while (centroids.length < k) {
    let bestIdx = -1
    let bestDist = -1
    for (let i = 0; i < n; i++) {
      const p = points[i]
      let minD2 = Infinity
      for (let c of centroids) {
        const d2 = euclid2(p, c)
        if (d2 < minD2) minD2 = d2
      }
      if (minD2 > bestDist) {
        bestDist = minD2
        bestIdx = i
      }
    }
    if (bestIdx === -1) break
    centroids.push({ lat: points[bestIdx].lat, lng: points[bestIdx].lng })
  }
  while (centroids.length < k) {
    const p = points[centroids.length % n]
    centroids.push({ lat: p.lat, lng: p.lng })
  }

  let assignments = new Array(n).fill(0)
  let clusterVolumes = new Array(k).fill(0)

  for (let iter = 0; iter < maxIterations; iter++) {
    const newAssignments = new Array(n)
    const newVolumes = new Array(k).fill(0)
    const sumLat = new Array(k).fill(0)
    const sumLng = new Array(k).fill(0)

    // Assignation
    for (let i = 0; i < n; i++) {
      const p = points[i]
      const vol = volumes[i] || 0

      let bestCluster = 0
      let bestCost = Infinity

      for (let cIdx = 0; cIdx < k; cIdx++) {
        const c = centroids[cIdx]
        let cost = euclid2(p, c)

        if (maxDistanceKm != null) {
          const dKm = haversineKm(p.lat, p.lng, c.lat, c.lng)
          if (dKm > maxDistanceKm) {
            cost *= 1e6 // très forte pénalité
          }
        }

        if (weightByVolume) {
          const zoneVol = clusterVolumes[cIdx] || targetVolume
          const ratio = Math.max(0.2, Math.min(zoneVol / targetVolume, 5))
          const factor = Math.sqrt(ratio)
          cost *= factor
        }

        newAssignments && cost < bestCost && (bestCost = cost, bestCluster = cIdx)
      }

      newAssignments[i] = bestCluster
      newVolumes[bestCluster] += vol
      sumLat[bestCluster] += p.lat * (weightByVolume ? vol || 1 : 1)
      sumLng[bestCluster] += p.lng * (weightByVolume ? vol || 1 : 1)
    }

    // Recalcul des centroïdes
    let maxShift = 0
    for (let cIdx = 0; cIdx < k; cIdx++) {
      const weightSum = weightByVolume
        ? newVolumes[cIdx] || 0
        : points.reduce(
            (s, _, i) => s + (newAssignments[i] === cIdx ? 1 : 0),
            0
          )

      if (weightSum === 0) continue

      const newLat = sumLat[cIdx] / weightSum
      const newLng = sumLng[cIdx] / weightSum
      const old = centroids[cIdx]
      const shift = Math.sqrt((old.lat - newLat) ** 2 + (old.lng - newLng) ** 2)
      if (shift > maxShift) maxShift = shift
      centroids[cIdx] = { lat: newLat, lng: newLng }
    }

    assignments = newAssignments
    clusterVolumes = newVolumes

    if (maxShift < tolerance) break
  }

  // Gestion des clusters vides
  for (let cIdx = 0; cIdx < k; cIdx++) {
    if (clusterVolumes[cIdx] > 0) continue
    // trouver cluster le plus chargé
    let heavyIdx = 0
    for (let j = 1; j < k; j++) {
      if (clusterVolumes[j] > clusterVolumes[heavyIdx]) heavyIdx = j
    }
    const heavyPoints = []
    for (let i = 0; i < n; i++) {
      if (assignments[i] === heavyIdx) {
        heavyPoints.push(i)
      }
    }
    if (!heavyPoints.length) continue
    // point le plus éloigné du centroïde de la zone lourde
    let farIdx = heavyPoints[0]
    let farDist = -1
    const c = centroids[heavyIdx]
    for (let i of heavyPoints) {
      const d2 = euclid2(points[i], c)
      if (d2 > farDist) {
        farDist = d2
        farIdx = i
      }
    }
    assignments[farIdx] = cIdx
    clusterVolumes[cIdx] += volumes[farIdx]
    clusterVolumes[heavyIdx] -= volumes[farIdx]
  }

  // Post-traitement simple pour gros déséquilibres
  const avgVolume = totalVolume / k || 1
  for (let cIdx = 0; cIdx < k; cIdx++) {
    if (clusterVolumes[cIdx] <= 2 * avgVolume) continue
    // déplacer quelques points les plus éloignés vers les clusters les plus légers
    const zonePointsIdx = []
    for (let i = 0; i < n; i++) {
      if (assignments[i] === cIdx) zonePointsIdx.push(i)
    }
    zonePointsIdx.sort((ia, ib) => {
      const da = euclid2(points[ia], centroids[cIdx])
      const db = euclid2(points[ib], centroids[cIdx])
      return db - da
    })

    for (let idx of zonePointsIdx) {
      if (clusterVolumes[cIdx] <= 2 * avgVolume) break
      // trouver cluster le plus léger
      let lightIdx = 0
      for (let j = 1; j < k; j++) {
        if (clusterVolumes[j] < clusterVolumes[lightIdx]) lightIdx = j
      }
      if (lightIdx === cIdx) break
      assignments[idx] = lightIdx
      clusterVolumes[cIdx] -= volumes[idx]
      clusterVolumes[lightIdx] += volumes[idx]
    }
  }

  const assignmentsById = {}
  for (let i = 0; i < n; i++) {
    const id = points[i].id ?? i
    assignmentsById[id] = assignments[i]
  }

  return {
    assignmentsById,
    centroids,
    volumes: clusterVolumes,
    totalVolume,
  }
}

