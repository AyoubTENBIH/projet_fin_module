import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet'
import { motion } from 'framer-motion'
import { Plus, FileSpreadsheet, MapPin, Trash2, Search } from 'lucide-react'
import L from 'leaflet'
import { analyzeDensity } from '../../utils/densityAnalysis'
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

function createColoredIcon(color, blinking = false) {
  return L.divIcon({
    className: 'density-marker',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);${blinking ? 'animation: blink 1s ease-in-out infinite;' : ''}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}
const ICON_KEPT = createColoredIcon('#22c55e')
const ICON_DENSE_KEPT = createColoredIcon('#f97316')
const ICON_CANDIDATE = createColoredIcon('#ef4444', true)

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
  onRemovePoints,
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
  const [densityResult, setDensityResult] = useState(null)
  const [proximityThreshold, setProximityThreshold] = useState(100)
  const [showDensityPanel, setShowDensityPanel] = useState(false)
  const [manualSelection, setManualSelection] = useState(new Set())
  const [manualMode, setManualMode] = useState(false)

  useEffect(() => {
    if (showDensityPanel && (points?.length ?? 0) > 0) {
      setDensityResult(analyzeDensity(points ?? [], proximityThreshold))
      setManualSelection(new Set())
      setManualMode(false)
    }
  }, [proximityThreshold, showDensityPanel, points])

  const mapCenter = useMemo(() => {
    if (depot && depot.lat != null && depot.lng != null) {
      return [depot.lat, depot.lng]
    }
    if (points && points.length) {
      const n = points.length
      const avgLat = points.reduce((s, p) => s + (p.lat || 0), 0) / n
      const avgLng = points.reduce((s, p) => s + (p.lng || 0), 0) / n
      return [avgLat || CASABLANCA_LAT, avgLng || CASABLANCA_LNG]
    }
    return CASABLANCA_CENTER
  }, [depot, points])

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
                    center={mapCenter}
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
                        {points.filter((p) => p && (p.lat != null) && (p.lng != null)).map((p) => {
                          let icon = depot?.id === p.id ? DEPOT_ICON : DEFAULT_ICON
                          if (densityResult?.byPointId[p.id]) {
                            const info = densityResult.byPointId[p.id]
                            if (info.candidate) icon = ICON_CANDIDATE
                            else if (info.category === 'dense') icon = ICON_DENSE_KEPT
                            else icon = ICON_KEPT
                          }
                          return (
                          <Marker
                            key={p.id}
                            position={[p.lat, p.lng]}
                            icon={icon}
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
                          )
                        })}
                        {densityResult?.candidates?.length > 0 && (() => {
                          const pointsById = Object.fromEntries((points ?? []).map((p) => [p.id, p]))
                          return densityResult.candidates.map((c) => {
                            const ref = pointsById[c.referenceId]
                            if (!ref || !pointsById[c.id]) return null
                            return (
                              <Polyline
                                key={`line-${c.id}-${c.referenceId}`}
                                positions={[
                                  [pointsById[c.id].lat, pointsById[c.id].lng],
                                  [ref.lat, ref.lng],
                                ]}
                                pathOptions={{ color: '#ef4444', weight: 2, opacity: 0.7, dashArray: '5,5' }}
                              />
                            )
                          })
                        })()}
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
            <Button
              variant="ghost"
              onClick={() => {
                const result = analyzeDensity(points ?? [], proximityThreshold)
                setDensityResult(result)
                setShowDensityPanel(true)
                setManualSelection(new Set())
              }}
              icon={<Search className="w-4 h-4" />}
            >
              Analyser Densité
            </Button>
          </div>

          {showDensityPanel && densityResult && (
            <Card className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#222222]">Résultats analyse densité</h3>
                <button
                  type="button"
                  onClick={() => { setShowDensityPanel(false); setDensityResult(null); setManualMode(false); }}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Fermer
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#222222] mb-1">
                  Seuil de proximité : {proximityThreshold} m
                </label>
                <input
                  type="range"
                  min={50}
                  max={300}
                  step={10}
                  value={proximityThreshold}
                  onChange={(e) => setProximityThreshold(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-[#222222]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <p className="text-[#717171]">Bennes analysées</p>
                <p className="font-medium">{densityResult.totalAnalyzed}</p>
                <p className="text-[#717171]">Candidates à la suppression</p>
                <p className="font-medium text-red-600">{densityResult.candidates.length}</p>
                <p className="text-[#717171]">Volume perdu si suppression (kg)</p>
                <p className="font-medium">{densityResult.totalVolumeToLose}</p>
              </div>
              {densityResult.candidates.length > 0 && (
                <>
                  <p className="text-sm font-medium text-[#222222] mb-2">Liste des bennes candidates</p>
                  <div className="max-h-48 overflow-y-auto space-y-1 mb-4 pr-2">
                    {densityResult.candidates.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        {manualMode ? (
                          <input
                            type="checkbox"
                            checked={manualSelection.has(c.id)}
                            onChange={(e) => {
                              setManualSelection((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(c.id)
                                else next.delete(c.id)
                                return next
                              })
                            }}
                          />
                        ) : null}
                        <span className="flex-1">{c.nom}</span>
                        <span className="text-gray-500">{c.distanceToReference} m → réf.</span>
                        <span className="text-gray-500">{c.volume} kg</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!manualMode ? (
                      <>
                        <Button
                          variant="primary"
                          onClick={() => {
                            const ids = densityResult.candidates.map((c) => c.id)
                            onRemovePoints?.(ids)
                            setShowDensityPanel(false)
                            setDensityResult(null)
                          }}
                        >
                          Supprimer les bennes redondantes
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setManualMode(true)}
                        >
                          Choisir manuellement
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          onClick={() => {
                            if (manualSelection.size > 0) {
                              onRemovePoints?.(Array.from(manualSelection))
                              setShowDensityPanel(false)
                              setDensityResult(null)
                              setManualSelection(new Set())
                            }
                            setManualMode(false)
                          }}
                          disabled={manualSelection.size === 0}
                        >
                          Supprimer la sélection
                        </Button>
                        <Button variant="ghost" onClick={() => { setManualMode(false); setManualSelection(new Set()); }}>
                          Annuler
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
              {densityResult.candidates.length === 0 && (
                <p className="text-sm text-[#717171]">Aucune benne candidate à la suppression pour ce seuil.</p>
              )}
            </Card>
          )}

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
