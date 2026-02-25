import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { motion } from 'framer-motion'
import { Plus, FileSpreadsheet, MapPin, Trash2 } from 'lucide-react'
import L from 'leaflet'
import Button from '../common/Button'
import Card from '../common/Card'
import Stepper from '../common/Stepper'

// Fix Leaflet default icon with Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const CASABLANCA_CENTER = [33.5731, -7.5898]
const DEFAULT_ZOOM = 13

// Icônes créées une seule fois pour éviter de perturber Leaflet à chaque render
const DEPOT_ICON = L.divIcon({
  className: 'depot-icon',
  html: '<div style="background:#dc3545;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px">🏭</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const DECHETTERIE_ICON = L.divIcon({
  className: 'dechetterie-icon',
  html: '<div style="background:#9b59b6;width:32px;height:32px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px">♻️</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const DEFAULT_ICON = new L.Icon.Default()

/** Notifie quand la carte Leaflet est vraiment prête (évite createIcon / _leaflet_events undefined) */
function MapReadyNotifier({ onReady }) {
  const map = useMap()
  const notified = useRef(false)
  useEffect(() => {
    if (!map || notified.current) return
    map.whenReady(() => {
      if (notified.current) return
      notified.current = true
      onReady?.()
    })
  }, [map, onReady])
  return null
}

function MapClickHandler({ onMapClick, onDechetterieClick, dechetterieMode }) {
  useMapEvents({
    click(e) {
      if (dechetterieMode) {
        onDechetterieClick?.(e.latlng.lat, e.latlng.lng)
      } else {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

const CASABLANCA_LAT = 33.5731
const CASABLANCA_LNG = -7.5898

export default function PointsConfig({
  points,
  depot,
  onDepotChange,
  dechetteries,
  onAddDechetterie,
  onRemoveDechetterie,
  onMapClickAdd,
  onManualAdd,
  onRemovePoint,
  onNext,
  onBack,
  onImport,
}) {
  const [showManualModal, setShowManualModal] = useState(false)
  const [showDechetterieModal, setShowDechetterieModal] = useState(false)
  const [addDechetterieMode, setAddDechetterieMode] = useState(false)
  const [dechetterieForm, setDechetterieForm] = useState({
    nom: '',
    capacite_max: 0,
    lat: CASABLANCA_LAT,
    lng: CASABLANCA_LNG,
  })
  const [manualForm, setManualForm] = useState({
    nom: '',
    volume: 1200,
    lat: CASABLANCA_LAT,
    lng: CASABLANCA_LNG,
  })
  const [mapReady, setMapReady] = useState(false)
  const [mapInstanceReady, setMapInstanceReady] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const prevCountRef = useRef({ points: 0, dechetteries: 0 })

  // Après import ou gros changement : retirer les marqueurs puis démonter la carte pour éviter _leaflet_events au cleanup
  useEffect(() => {
    const pointsCount = points?.length ?? 0
    const dechetteriesCount = (dechetteries ?? []).length
    const prev = prevCountRef.current
    const bigChange =
      pointsCount > prev.points + 10 ||
      dechetteriesCount > prev.dechetteries + 5 ||
      (prev.points === 0 && pointsCount > 0)
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[PointsConfig] Points:', pointsCount, 'Dechetteries:', dechetteriesCount, 'BigChange:', bigChange)
    }
    
    prevCountRef.current = { points: pointsCount, dechetteries: dechetteriesCount }

    if (bigChange) {
      setMapInstanceReady(false)
      const t1 = setTimeout(() => {
        setMapReady(false)
        setMapKey((k) => k + 1)
      }, 80)
      const t2 = setTimeout(() => setMapReady(true), 80 + (pointsCount > 0 ? 500 : 200))
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }

    if (!mapReady) {
      const delay = pointsCount > 0 ? 500 : 200
      const id = setTimeout(() => setMapReady(true), delay)
      return () => clearTimeout(id)
    }
  }, [points?.length, (dechetteries ?? []).length, mapReady])

  const handleMapReady = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PointsConfig] Map instance ready')
    }
    setMapInstanceReady(true)
  }, [])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!manualForm.nom.trim()) return
    onManualAdd({ ...manualForm })
    setManualForm({ nom: '', volume: 1200, lat: CASABLANCA_LAT, lng: CASABLANCA_LNG })
    setShowManualModal(false)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-[#EBEBEB] px-8 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-[#717171] hover:text-[#222222]">
              ← Retour
            </button>
            <h1 className="text-xl font-semibold text-[#222222]">Configuration</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12">
        <Stepper currentStep="points" />
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-[#222222] mb-2">
              1. Définissez votre zone de collecte
            </h2>
            <p className="text-[#717171]">Cliquez sur la carte pour ajouter des points de collecte</p>
          </div>

          {/* Carte : loading jusqu'à whenReady pour éviter createIcon / _leaflet_events undefined */}
          <div className="bg-white rounded-xl border border-[#EBEBEB] shadow-[0_1px_3px_rgba(0,0,0,0.12)] overflow-hidden">
            <div className="h-[400px] w-full relative bg-gray-100">
              {!mapReady ? (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  Chargement de la carte...
                </div>
              ) : (
                <>
                  <MapContainer
                    key={`points-map-${mapKey}`}
                    center={CASABLANCA_CENTER}
                    zoom={DEFAULT_ZOOM}
                    className="h-full w-full"
                    style={{ minHeight: 400 }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapReadyNotifier onReady={handleMapReady} />
                    <MapClickHandler
                      onMapClick={onMapClickAdd}
                      onDechetterieClick={(lat, lng) => {
                        setDechetterieForm((f) => ({ ...f, lat, lng }))
                        setShowDechetterieModal(true)
                        setAddDechetterieMode(false)
                      }}
                      dechetterieMode={addDechetterieMode}
                    />
                    {/* Marqueurs uniquement quand la carte est prête (évite createIcon / _leaflet_events) */}
                    {mapInstanceReady && (
                      <>
                        {(dechetteries || []).filter((d) => d && d.lat != null && d.lng != null).map((d) => (
                          <Marker
                            key={`d-${d.id}`}
                            position={[d.lat, d.lng]}
                            icon={DECHETTERIE_ICON}
                          >
                            <Popup>
                              <div className="p-2">
                                <p className="font-semibold">♻️ {d.nom || `Déchetterie ${d.id}`}</p>
                                <button
                                  onClick={() => onRemoveDechetterie?.(d.id)}
                                  className="mt-2 text-red-500 text-sm hover:underline"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                        {points.filter((p) => p && (p.lat != null) && (p.lng != null)).map((p) => (
                          <Marker
                            key={p.id}
                            position={[p.lat, p.lng]}
                            icon={depot?.id === p.id ? DEPOT_ICON : DEFAULT_ICON}
                          >
                            <Popup>
                              <div className="p-2">
                                <p className="font-semibold">{p.nom || `Point ${p.id}`}</p>
                                <p className="text-sm text-gray-600">{p.volume} kg</p>
                                <button
                                  onClick={() => onRemovePoint(p.id)}
                                  className="mt-2 text-red-500 text-sm hover:underline"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </>
                    )}
                  </MapContainer>
                  {mapReady && !mapInstanceReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 text-gray-500 z-[1000]">
                      Chargement de la carte...
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t border-[#EBEBEB] flex flex-wrap gap-4 justify-between">
              <p className="text-sm text-[#717171]">Points : {points.length} · Déchetteries : {(dechetteries || []).length}</p>
              {depot && (
                <p className="text-sm font-medium text-[#222222]">Dépôt : {depot.nom || `Point ${depot.id}`}</p>
              )}
            </div>
          </div>

          <Card>
            <h3 className="text-lg font-semibold text-[#222222] mb-3">🏭 Dépôt</h3>
            <p className="text-sm text-[#717171] mb-3">Point de départ et d&apos;arrivée des camions</p>
            <select
              value={depot?.id ?? ''}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10)
                const p = points.find((x) => x.id === id)
                if (p) onDepotChange?.(p)
              }}
              className="w-full max-w-xs px-4 py-2 rounded-lg border border-[#EBEBEB]"
            >
              <option value="">Sélectionner un point...</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom || `Point ${p.id}`}
                </option>
              ))}
            </select>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-[#222222] mb-3">♻️ Déchetteries</h3>
            <p className="text-sm text-[#717171] mb-3">Centres de traitement où les camions déposent les déchets</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowDechetterieModal(true)}>
                Ajouter une déchetterie
              </Button>
              <Button
                variant={addDechetterieMode ? 'primary' : 'ghost'}
                onClick={() => setAddDechetterieMode(!addDechetterieMode)}
              >
                {addDechetterieMode ? 'Cliquez sur la carte →' : 'Placer sur la carte'}
              </Button>
            </div>
            {(dechetteries || []).length > 0 && (
              <div className="space-y-2">
                {(dechetteries || []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">♻️ {d.nom || `Déchetterie ${d.id}`}</span>
                    <button onClick={() => onRemoveDechetterie?.(d.id)} className="text-red-500 hover:underline text-sm">
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex flex-wrap gap-4">
            <Button
              variant="secondary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowManualModal(true)}
            >
              Ajouter un point manuellement
            </Button>
            <Button variant="ghost" onClick={onImport} icon={<FileSpreadsheet className="w-4 h-4" />}>
              Importer CSV
            </Button>
          </div>

          <div className="flex justify-end pt-8">
            <Button variant="primary" onClick={onNext} disabled={points.length < 2 || !depot}>
              Suivant : Camions →
            </Button>
          </div>
        </div>
      </main>

      {/* Modal point manuel */}
      {showManualModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowManualModal(false)}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
          >
            <h3 className="text-xl font-bold mb-6">Ajouter un point manuellement</h3>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Nom</label>
                <input
                  type="text"
                  value={manualForm.nom}
                  onChange={(e) => setManualForm({ ...manualForm, nom: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50"
                  placeholder="Quartier Nord"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Volume (kg)</label>
                <input
                  type="number"
                  min="0"
                  value={manualForm.volume}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, volume: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={manualForm.lat}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, lat: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={manualForm.lng}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, lng: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" variant="primary" className="flex-1">
                  Ajouter
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowManualModal(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal déchetterie */}
      {showDechetterieModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowDechetterieModal(false)}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
          >
            <h3 className="text-xl font-bold mb-6">Ajouter une déchetterie</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const ids = (dechetteries ?? []).map((d) => Number(d?.id)).filter((n) => !Number.isNaN(n))
                const id = ids.length ? Math.max(...ids) + 1 : 11
                onAddDechetterie?.({ ...dechetterieForm, id })
                setDechetterieForm({ nom: '', capacite_max: 0, lat: CASABLANCA_LAT, lng: CASABLANCA_LNG })
                setShowDechetterieModal(false)
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Nom</label>
                <input
                  type="text"
                  value={dechetterieForm.nom}
                  onChange={(e) => setDechetterieForm({ ...dechetterieForm, nom: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                  placeholder="Déchetterie Nord"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Capacité max (kg, 0 = illimitée)</label>
                <input
                  type="number"
                  min="0"
                  value={dechetterieForm.capacite_max}
                  onChange={(e) => setDechetterieForm({ ...dechetterieForm, capacite_max: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={dechetterieForm.lat}
                    onChange={(e) => setDechetterieForm({ ...dechetterieForm, lat: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={dechetterieForm.lng}
                    onChange={(e) => setDechetterieForm({ ...dechetterieForm, lng: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" variant="primary" className="flex-1">
                  Ajouter
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowDechetterieModal(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
