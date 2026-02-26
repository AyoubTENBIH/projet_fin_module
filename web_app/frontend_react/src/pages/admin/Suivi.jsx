import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ecoAgadirApi } from '../../utils/ecoAgadirApi'

const CASABLANCA = [33.5731, -7.5898]

function LiveMarkers({ live }) {
  const map = useMap()
  useEffect(() => {
    if (!live?.length) return
    const bounds = L.latLngBounds(live.map((x) => [x.last_position?.lat, x.last_position?.lng]).filter((c) => c[0] != null));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] })
  }, [live, map])
  return (
    <>
      {live?.map(
        (item) =>
          item.last_position?.lat != null && (
            <Marker
              key={item.planning_id}
              position={[item.last_position.lat, item.last_position.lng]}
              icon={L.divIcon({ className: 'custom-marker', html: '<div style="background:#00a86b;width:16px;height:16px;border-radius:50%;border:2px solid white;"></div>' })}
            />
          )
      )}
    </>
  )
}

export default function Suivi() {
  const [live, setLive] = useState([])
  const [plannings, setPlannings] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    function update() {
      ecoAgadirApi.tracking.live().then(setLive).catch(() => {})
      ecoAgadirApi.planning.list({ status: 'en_cours' }).then(setPlannings).catch(() => {})
      ecoAgadirApi.users.list({ role: 'chauffeur' }).then(setUsers).catch(() => {})
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]))

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">Suivi Temps Réel</h1>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden border border-[var(--color-border)]">
          <MapContainer center={CASABLANCA} zoom={12} className="h-[70vh] w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            <LiveMarkers live={live} />
          </MapContainer>
        </div>
        <div className="w-full lg:w-80 rounded-xl border border-[var(--color-border)] bg-white p-4 max-h-[70vh] overflow-y-auto">
          <h3 className="font-semibold mb-3">Missions en cours</h3>
          {plannings.length === 0 && <p className="text-[var(--color-text-muted)]">Aucune mission en cours.</p>}
          {plannings.map((p) => {
            const u = usersById[p.chauffeur_id]
            const total = p.points?.length ?? 0
            const done = p.points?.filter((pp) => pp.collecte_effectuee).length ?? 0
            const pct = total ? Math.round((100 * done) / total) : 0
            return (
              <div
                key={p.id}
                className="p-3 rounded-lg border-l-4 border-[var(--primary)] bg-gray-50 mb-2"
              >
                <strong>🚛 {p.camion_id || '-'}</strong>
                <br />
                Chauffeur: {u ? u.nom : p.chauffeur_id}
                <br />
                Zone - {p.shift || ''}
                <br />
                <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                  <div className="h-full bg-[var(--primary)] rounded" style={{ width: pct + '%' }} />
                </div>
                {done}/{total} points
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
