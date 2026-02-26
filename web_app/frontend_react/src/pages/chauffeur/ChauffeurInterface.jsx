import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { useAuth } from '../../context/AuthContext'
import { ecoAgadirApi } from '../../utils/ecoAgadirApi'

const CASABLANCA = [33.5731, -7.5898]

export default function ChauffeurInterface() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [planning, setPlanning] = useState(null)
  const [points, setPoints] = useState([])
  const [position, setPosition] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ecoAgadirApi
      .planning.list({ chauffeur_id: user.id, status: 'en_cours' })
      .then((list) => {
        if (list.length) {
          ecoAgadirApi.planning.get(list[0].id).then(setPlanning)
        } else {
          ecoAgadirApi.planning.list({ chauffeur_id: user.id, date_from: new Date().toISOString().slice(0, 10), date_to: new Date().toISOString().slice(0, 10) }).then((l) => {
            if (l.length) setPlanning(l[0])
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!planning?.points) return
    setPoints(planning.points.sort((a, b) => a.ordre - b.ordre))
  }, [planning])

  const nextPoint = points.find((p) => !p.collecte_effectuee)
  const doneCount = points.filter((p) => p.collecte_effectuee).length
  const totalCount = points.length
  const pct = totalCount ? Math.round((100 * doneCount) / totalCount) : 0

  async function marquerCollecte(pointId, poids) {
    if (!planning) return
    await ecoAgadirApi.planning.marquerCollecte(planning.id, pointId, poids || 0)
    const updated = await ecoAgadirApi.planning.get(planning.id)
    setPlanning(updated)
  }

  if (!user) return null
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0f1923] text-white">Chargement...</div>

  return (
    <div className="min-h-screen bg-[#0f1923] text-[#e8f0f7] pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#0f1923] border-b border-white/10">
        <span className="text-lg font-bold text-[var(--primary)]">🌿 EcoAgadir</span>
        <span className="text-sm">{user.avatar || user.nom?.slice(0, 2)}</span>
      </header>
      <div className="px-4 py-2 text-sm text-[var(--color-text-muted)]">
        Mission: Zone {user.zone_affectee ?? '-'} - {planning?.shift === 'matin' ? 'Matin' : 'Après-Midi'}
      </div>

      {!planning ? (
        <div className="p-6 text-center">
          <p className="mb-4">Aucune mission planifiée pour aujourd&apos;hui.</p>
          <button onClick={() => logout()} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white">
            Se déconnecter
          </button>
        </div>
      ) : (
        <>
          <div className="h-[45vh] min-h-[280px] rounded-lg overflow-hidden mx-4 mb-4 border border-white/10">
            <MapContainer center={CASABLANCA} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {nextPoint && <Marker position={[33.57, -7.59]} />}
            </MapContainer>
          </div>

          {nextPoint && (
            <div className="mx-4 p-3 rounded-lg bg-white/5 border border-white/10 mb-3">
              <div className="text-xs text-[var(--color-text-muted)]">📍 Prochain</div>
              <div className="font-medium">Point #{nextPoint.point_id}</div>
              <div className="text-sm text-[var(--color-text-muted)]">← ~1.2 km | ~8 min</div>
            </div>
          )}

          <div className="mx-4 mb-3">
            <div className="h-2 bg-white/20 rounded overflow-hidden">
              <div className="h-full bg-[var(--primary)] rounded transition-all" style={{ width: pct + '%' }} />
            </div>
            <div className="text-sm mt-1">{doneCount}/{totalCount} points</div>
          </div>

          <div className="mx-4 mb-4">
            <div className="text-sm font-medium mb-2">Liste des points</div>
            <div className="space-y-2">
              {points.map((pp, i) => (
                <div key={pp.point_id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <span>{pp.collecte_effectuee ? '✅' : nextPoint?.point_id === pp.point_id ? '🔵' : '⏳'} Point {pp.point_id}</span>
                  {pp.collecte_effectuee && <span className="text-xs">{pp.poids_collecte} kg</span>}
                  {!pp.collecte_effectuee && nextPoint?.point_id === pp.point_id && (
                    <button
                      onClick={() => {
                        const p = prompt('Poids collecté (kg)', '0')
                        marquerCollecte(pp.point_id, parseInt(p, 10) || 0)
                      }}
                      className="px-3 py-1.5 rounded-lg text-white bg-[var(--success)] text-sm font-medium"
                    >
                      Marquer collecté
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f1923] border-t border-white/10">
            <button
              onClick={() => logout()}
              className="w-full py-3 rounded-lg font-medium bg-white/10 text-white"
            >
              Déconnexion
            </button>
          </div>
        </>
      )}
    </div>
  )
}
