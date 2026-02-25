import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { xyToLatLng, getOsrmRoute } from '../../utils/api'

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

function MapBounds({ points, depot, dechetteries, routes }) {
  const map = useMap()
  useEffect(() => {
    const all = [
      ...(points || []).map((p) => [p.lat, p.lng]),
      ...(depot ? [[depot.lat, depot.lng]] : []),
      ...(dechetteries || []).map((d) => [d.lat, d.lng]),
    ]
    if (routes?.routes) {
      routes.routes.forEach((r) => {
        (r.waypoints || []).forEach((wp) => {
          const { lat, lng } = xyToLatLng(wp.x, wp.y)
          all.push([lat, lng])
        })
      })
    }
    if (all.length >= 2) {
      map.fitBounds(all, { padding: [40, 40] })
    }
  }, [map, points, depot, dechetteries, routes])
  return null
}

function AnimatedPolyline({ route, color, progress, osrmCoords }) {
  const waypoints = route?.waypoints || []
  const linearCoords = waypoints.map((wp) => {
    const { lat, lng } = xyToLatLng(wp.x, wp.y)
    return [lat, lng]
  })
  const coords = (osrmCoords?.length >= 2 ? osrmCoords : linearCoords)
  if (coords.length < 2) return null

  const idx = Math.floor(progress * (coords.length - 1))
  const drawn = coords.slice(0, Math.max(1, idx + 1))

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
          <Popup>Camion {route.camion_id}</Popup>
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

export default function MapWithRoutes({
  routes,
  points,
  depot,
  dechetteries,
  animate = true,
}) {
  const [progress, setProgress] = useState({})
  const [osrmData, setOsrmData] = useState({})
  const [osrmLoading, setOsrmLoading] = useState(false)
  const animRef = useRef(null)

  useEffect(() => {
    if (!routes?.routes?.length) {
      setOsrmData({})
      return
    }
    let cancelled = false
    setOsrmLoading(true)
    const promises = routes.routes.map(async (route) => {
      const waypoints = (route.waypoints || []).map((wp) => xyToLatLng(wp.x, wp.y))
      if (waypoints.length < 2) return { camion_id: route.camion_id, data: null }
      const data = await getOsrmRoute(waypoints)
      return { camion_id: route.camion_id, data }
    })
    batchOsrmRequests(promises, 3).then((results) => {
      if (cancelled) return
      const next = {}
      results.forEach(({ camion_id, data }) => {
        next[camion_id] = data?.coordinates || null
      })
      setOsrmData(next)
      setOsrmLoading(false)
    })
    return () => { cancelled = true }
  }, [routes?.routes])

  useEffect(() => {
    if (!animate || !routes?.routes?.length) return
    const start = Date.now()
    const duration = 8000

    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / duration, 1)
      const next = {}
      routes.routes.forEach((r) => {
        next[r.camion_id] = t
      })
      setProgress(next)
      if (t < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [animate, routes])

  const CASABLANCA = [33.5731, -7.5898]

  return (
    <div className="relative h-[500px] w-full rounded-xl overflow-hidden border border-[#EBEBEB]">
      <MapContainer center={CASABLANCA} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds points={points} depot={depot} dechetteries={dechetteries} routes={routes} />

        {depot && (
          <Marker
            position={[depot.lat, depot.lng]}
            icon={DEPOT_ICON}
          >
            <Popup>Dépôt</Popup>
          </Marker>
        )}

        {(points || []).map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={DEFAULT_ICON}>
            <Popup>{p.nom || `Point ${p.id}`}</Popup>
          </Marker>
        ))}

        {(dechetteries || []).map((d) => (
          <Marker
            key={d.id}
            position={[d.lat, d.lng]}
            icon={DECHETTERIE_ICON}
          >
            <Popup>♻️ {d.nom || `Déchetterie ${d.id}`}</Popup>
          </Marker>
        ))}

        {routes?.routes?.map((route, i) => (
          <AnimatedPolyline
            key={route.camion_id}
            route={route}
            color={ROUTE_COLORS[i % ROUTE_COLORS.length]}
            progress={progress[route.camion_id] ?? 0}
            osrmCoords={osrmData[route.camion_id]}
          />
        ))}
      </MapContainer>
      {osrmLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 px-4 py-2 rounded-lg shadow-lg text-sm text-gray-700">
          Chargement des routes OSRM…
        </div>
      )}
    </div>
  )
}
