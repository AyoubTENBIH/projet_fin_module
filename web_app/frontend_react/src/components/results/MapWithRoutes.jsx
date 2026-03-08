import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap, LayerGroup } from 'react-leaflet'
import L from 'leaflet'
import { xyToLatLng, getOsrmRoute } from '../../utils/api'
import { convexHull, bufferPolygon, centroid, buildZonePolygonFromPoints } from '../../utils/zoneGeometry'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const ROUTE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12']

// Icônes créées une seule fois pour éviter problèmes Leaflet (createIcon / _leaflet_events)
const DEPOT_ICON = L.divIcon({
  className: 'depot-marker',
  html: '<div style="background:#dc3545;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px">🏭</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const DECHETTERIE_ICON = L.divIcon({
  className: 'dechetterie-marker',
  html: '<div style="background:#9b59b6;width:28px;height:28px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:14px">♻️</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const DEFAULT_ICON = new L.Icon.Default()

// Créer une icône de camion par couleur pour éviter de les recréer à chaque frame d'animation
const TRUCK_ICONS = ROUTE_COLORS.reduce((acc, color) => {
  acc[color] = L.divIcon({
    className: 'truck-marker',
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px">🚛</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
  return acc
}, {})

function MapBounds({ points, depot, dechetteries, routesList }) {
  const map = useMap()
  useEffect(() => {
    const all = [
      ...(points || []).map((p) => [p.lat, p.lng]),
      ...(depot ? [[depot.lat, depot.lng]] : []),
      ...(dechetteries || []).map((d) => [d.lat, d.lng]),
    ]
    if (routesList?.length) {
      routesList.forEach((r) => {
        (r.waypoints || []).forEach((wp) => {
          const { lat, lng } = xyToLatLng(wp.x, wp.y)
          all.push([lat, lng])
        })
      })
    }
    if (all.length >= 2) {
      map.fitBounds(all, { padding: [40, 40] })
    }
  }, [map, points, depot, dechetteries, routesList])
  return null
}

function AnimatedPolyline({ route, color, progress, osrmCoords, zoneLabel }) {
  const waypoints = route?.waypoints || []
  const linearCoords = waypoints.map((wp) => {
    const { lat, lng } = xyToLatLng(wp.x, wp.y)
    return [lat, lng]
  })
  const coords = (osrmCoords?.length >= 2 ? osrmCoords : linearCoords)
  if (coords.length < 2) return null

  const idx = Math.floor(progress * (coords.length - 1))
  const drawn = coords.slice(0, Math.max(1, idx + 1))
  const totalPoints = waypoints.filter((w) => w.type === 'collecte').length
  const collectedCount = Math.min(Math.floor(progress * (totalPoints + 1)), totalPoints) || 0
  const popupText = zoneLabel
    ? `🗺️ ${zoneLabel} · ${collectedCount}/${totalPoints} points`
    : `Camion ${route.camion_id}`

  return (
    <>
      <Polyline
        positions={coords}
        pathOptions={{
          color: color,
          weight: 3,
          opacity: 0.3,
          dashArray: '10, 10',
        }}
      />
      {drawn.length >= 2 && (
        <Polyline
          positions={drawn}
          pathOptions={{
            color: color,
            weight: 5,
            opacity: 0.9,
          }}
        />
      )}
      {drawn.length > 0 && (
        <Marker
          position={drawn[drawn.length - 1]}
          icon={TRUCK_ICONS[color] || TRUCK_ICONS[ROUTE_COLORS[0]]}
        >
          <Popup>{popupText}</Popup>
        </Marker>
      )}
    </>
  )
}

async function batchOsrmRequests(routePromises, maxConcurrent = 3) {
  const results = []
  for (let i = 0; i < routePromises.length; i += maxConcurrent) {
    const batch = routePromises.slice(i, i + maxConcurrent)
    const batchResults = await Promise.all(batch)
    results.push(...batchResults)
  }
  return results
}

// Liste normalisée : accepte { routes: [...] } ou tableau direct
function getRoutesList(routes) {
  if (!routes) return []
  if (Array.isArray(routes)) return routes
  return routes.routes ?? []
}

const defaultLayerVisibility = { zones: true, points: true, trajets: true }

export default function MapWithRoutes({
  routes,
  points,
  depot,
  dechetteries,
  zones = [],
  layerVisibility = defaultLayerVisibility,
  animate = true,
}) {
  const routesList = getRoutesList(routes)
  const [progress, setProgress] = useState({})
  const [osrmData, setOsrmData] = useState({})
  const [osrmZoneContours, setOsrmZoneContours] = useState({})
  const [osrmLoading, setOsrmLoading] = useState(false)
  const animRef = useRef(null)

  useEffect(() => {
    if (!routesList.length) {
      setOsrmData({})
      return
    }
    let cancelled = false
    setOsrmLoading(true)
    const promises = routesList.map(async (route, index) => {
      const waypoints = (route.waypoints || []).map((wp) => xyToLatLng(wp.x, wp.y))
      if (waypoints.length < 2) return { index, data: null }
      const data = await getOsrmRoute(waypoints)
      return { index, data }
    })
    batchOsrmRequests(promises, 3).then((results) => {
      if (cancelled) return
      const next = {}
      results.forEach(({ index, data }) => {
        next[index] = data?.coordinates || null
      })
      setOsrmData(next)
      setOsrmLoading(false)
    })
    return () => { cancelled = true }
  }, [routesList])

  useEffect(() => {
    if (!zones.length || !points?.length) {
      setOsrmZoneContours({})
      return
    }
    let cancelled = false
    const zoneIds = zones.map((z) => z.id)
    const promises = zoneIds.map(async (zoneId) => {
      const zone = zones.find((z) => z.id === zoneId)
      const pointIds = zone?.point_ids ?? zone?.points ?? []
      const zonePoints = points.filter((p) => pointIds.some((id) => id == p.id))
      if (zonePoints.length < 1) return { zoneId, coords: null }
      const coords = buildZonePolygonFromPoints(zonePoints, 0.004)
      return { zoneId, coords }
    })
    batchOsrmRequests(promises, 2).then((results) => {
      if (cancelled) return
      const next = {}
      results.forEach(({ zoneId, coords }) => {
        next[zoneId] = coords
      })
      setOsrmZoneContours(next)
    })
    return () => { cancelled = true }
  }, [zones, points])

  useEffect(() => {
    if (!animate || !routesList.length) return
    const start = Date.now()
    const duration = 8000

    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / duration, 1)
      const next = {}
      routesList.forEach((_, i) => {
        next[i] = t
      })
      setProgress(next)
      if (t < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [animate, routesList])

  const CASABLANCA = [33.5731, -7.5898]
  const showZones = layerVisibility.zones !== false && zones?.length > 0
  const showPoints = layerVisibility.points !== false
  const showTrajets = layerVisibility.trajets !== false

  return (
    <div className="relative h-[500px] w-full rounded-xl overflow-hidden border border-[#EBEBEB]">
      <MapContainer center={CASABLANCA} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds points={points} depot={depot} dechetteries={dechetteries} routesList={routesList} />

        {showZones && (
          <>
            <LayerGroup>
              {zones.map((zone) => {
                const pointIds = zone.point_ids ?? zone.points ?? []
                const zonePoints = points.filter((p) => pointIds.some((id) => id == p.id))
                const buffered = buildZonePolygonFromPoints(zonePoints, 0.004)
                if (!buffered || buffered.length < 3) return null
                return (
                  <Polygon
                    key={`zone-fond-${zone.id}`}
                    positions={buffered}
                    pathOptions={{
                      color: zone.couleur,
                      fillColor: zone.couleur,
                      fillOpacity: 0.08,
                      weight: 2,
                      opacity: 0.6,
                      dashArray: '8, 6',
                    }}
                  />
                )
              })}
            </LayerGroup>
            <LayerGroup>
              {zones.map((zone) => {
                const coords = osrmZoneContours[zone.id]
                if (!coords || coords.length < 2) return null
                return (
                  <Polyline
                    key={`zone-contour-${zone.id}`}
                    positions={coords}
                    pathOptions={{
                      color: zone.couleur,
                      weight: 3,
                      opacity: 0.5,
                      dashArray: '12, 8',
                    }}
                  />
                )
              })}
            </LayerGroup>
            <LayerGroup>
              {zones.map((zone) => {
                const pointIds = zone.point_ids ?? zone.points ?? []
                const zonePoints = points.filter((p) => pointIds.some((id) => id == p.id))
                const center = centroid(zonePoints)
                if (!center) return null
                return (
                  <Marker
                    key={`zone-label-${zone.id}`}
                    position={center}
                    icon={L.divIcon({
                      className: 'zone-label',
                      html: `
                        <div style="
                          background: ${zone.couleur}22;
                          border: 2px solid ${zone.couleur};
                          border-radius: 8px;
                          padding: 4px 10px;
                          font-weight: 700;
                          font-size: 12px;
                          color: ${zone.couleur};
                          white-space: nowrap;
                          backdrop-filter: blur(4px);
                          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        ">
                          ${zone.nom} · ${zonePoints.length} pts
                        </div>
                      `,
                      iconAnchor: [0, 0],
                    })}
                    zIndexOffset={-500}
                  />
                )
              })}
            </LayerGroup>
          </>
        )}

        {showPoints && (
          <>
            {depot && (
              <Marker position={[depot.lat, depot.lng]} icon={DEPOT_ICON}>
                <Popup>Dépôt</Popup>
              </Marker>
            )}
            {(points || []).map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={DEFAULT_ICON}>
                <Popup>{p.nom || `Point ${p.id}`}</Popup>
              </Marker>
            ))}
            {(dechetteries || []).map((d) => (
              <Marker key={d.id} position={[d.lat, d.lng]} icon={DECHETTERIE_ICON}>
                <Popup>♻️ {d.nom || `Déchetterie ${d.id}`}</Popup>
              </Marker>
            ))}
          </>
        )}

        {showTrajets &&
          routesList.map((route, i) => (
            <AnimatedPolyline
              key={`route-${route.camion_id ?? i}-${i}`}
              route={route}
              color={ROUTE_COLORS[i % ROUTE_COLORS.length]}
              progress={progress[i] ?? 0}
              osrmCoords={osrmData[i]}
              zoneLabel={route.zone_nom || null}
            />
          ))}
      </MapContainer>
      {osrmLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 px-4 py-2 rounded-lg shadow-lg text-sm text-gray-700">
          Chargement des routes (tracé réel)… Peut prendre 1–2 min pour beaucoup de tournées.
        </div>
      )}
    </div>
  )
}
