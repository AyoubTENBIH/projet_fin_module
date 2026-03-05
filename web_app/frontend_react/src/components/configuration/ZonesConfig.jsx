import { useState, useRef, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet'
import { motion } from 'framer-motion'
import { Plus, MapPin } from 'lucide-react'
import L from 'leaflet'
import Button from '../common/Button'
import Stepper from '../common/Stepper'
import { convexHull, bufferPolygon, centroid, buildZonePolygonFromPoints } from '../../utils/zoneGeometry'

const ZONE_COLORS = [
  '#E63946',
  '#2196F3',
  '#4CAF50',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
  '#FF5722',
  '#795548',
]

const CASABLANCA_CENTER = [33.5731, -7.5898]
const DEFAULT_ZOOM = 13

const DEFAULT_POINT_ICON = new L.Icon.Default()
const SELECTED_POINT_ICONS = ZONE_COLORS.reduce((acc, c) => {
  acc[c] = L.divIcon({
    className: 'zone-point-selected',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${c}33;border:3px solid ${c};box-shadow:0 0 6px ${c}88"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
  return acc
}, {})

function ZoneCard({ zone, points, camions, onEdit, onFocus }) {
  const pointIds = zone.point_ids || zone.points || []
  const zonePoints = points.filter((p) => pointIds.some((id) => id == p.id))
  const total = zonePoints.length
  const collectes = zone.collectes ?? 0
  const camionNames = (zone.camion_ids || zone.camions || [])
    .map((cid) => {
      const c = camions.find((x) => x.id === cid)
      return c ? `Camion ${c.id}` : null
    })
    .filter(Boolean)
  const areaKm2 = total ? (zone.area_km2 ?? '—') : '—'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onFocus(zone)}
      onKeyDown={(e) => e.key === 'Enter' && onFocus(zone)}
      style={{
        borderLeft: `4px solid ${zone.couleur}`,
        background: `${zone.couleur}08`,
        borderRadius: '8px',
        padding: '10px 12px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>{zone.nom}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(zone)
          }}
          className="p-1 rounded hover:bg-black/10"
          aria-label="Modifier"
        >
          ✏️
        </button>
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
        🚛 {camionNames.length ? camionNames.join(', ') : '—'} · {total} points
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
        ✅ {collectes}/{total} collectés · {areaKm2} km²
      </div>
      <div
        style={{
          height: '4px',
          background: '#eee',
          borderRadius: '2px',
          marginTop: '6px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${total ? (collectes / total) * 100 : 0}%`,
            background: zone.couleur,
            borderRadius: '2px',
            transition: 'width 0.5s',
          }}
        />
      </div>
    </div>
  )
}

function MapFocus({ zone, points }) {
  const map = useMap()
  useEffect(() => {
    if (!zone || !map) return
    const pointIds = zone.point_ids ?? zone.points ?? []
    const zonePoints = points.filter((p) => pointIds.includes(p.id))
    if (zonePoints.length === 0) return
    const coords = zonePoints.map((p) => [p.lat, p.lng])
    map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 })
  }, [map, zone?.id, points])
  return null
}

function MapFocusPreview({ previewZone, points }) {
  const map = useMap()
  useEffect(() => {
    if (!previewZone?.point_ids?.length || !map || !points?.length) return
    const zonePoints = points.filter((p) =>
      previewZone.point_ids.some((id) => id == p.id)
    )
    if (zonePoints.length < 2) return
    const coords = zonePoints.map((p) => [p.lat, p.lng])
    map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 })
  }, [map, previewZone, points])
  return null
}

export default function ZonesConfig({
  zones,
  points,
  camions,
  depot,
  dechetteries,
  onAddZone,
  onUpdateZone,
  onRemoveZone,
  onNext,
  onBack,
  onFocusZone,
}) {
  const [showZonesOnMap, setShowZonesOnMap] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [form, setForm] = useState({
    nom: '',
    couleur: ZONE_COLORS[0],
    point_ids: [],
    camion_ids: [],
  })
  const [focusZoneId, setFocusZoneId] = useState(null)
  const [previewZone, setPreviewZone] = useState(null)

  const collectionPoints = points.filter((p) => !depot || p.id !== depot.id)

  useEffect(() => {
    if (!showModal || !form.point_ids?.length) {
      setPreviewZone(null)
      return
    }
    setPreviewZone({
      point_ids: form.point_ids,
      couleur: form.couleur,
      nom: form.nom || 'Aperçu',
    })
  }, [showModal, form.point_ids, form.couleur, form.nom])

  const openCreate = () => {
    setEditingZone(null)
    setForm({
      nom: '',
      couleur: ZONE_COLORS[zones.length % ZONE_COLORS.length],
      point_ids: [],
      camion_ids: [],
    })
    setShowModal(true)
  }

  const openEdit = (zone) => {
    setEditingZone(zone)
    setForm({
      nom: zone.nom,
      couleur: zone.couleur || ZONE_COLORS[0],
      point_ids: zone.point_ids || zone.points || [],
      camion_ids: zone.camion_ids || zone.camions || [],
    })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.nom.trim()) return
    if (editingZone) {
      onUpdateZone(editingZone.id, {
        nom: form.nom.trim(),
        couleur: form.couleur,
        point_ids: form.point_ids,
        camion_ids: form.camion_ids,
      })
    } else {
      onAddZone({
        nom: form.nom.trim(),
        couleur: form.couleur,
        point_ids: form.point_ids,
        camion_ids: form.camion_ids,
      })
    }
    setPreviewZone(null)
    setShowModal(false)
  }

  const handleFocus = useCallback(
    (zone) => {
      setFocusZoneId(zone.id)
      onFocusZone?.(zone)
    },
    [onFocusZone]
  )

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-[#EBEBEB] px-8 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <button type="button" onClick={onBack} className="text-[#717171] hover:text-[#222222]">
            ← Retour
          </button>
          <h1 className="text-xl font-semibold text-[#222222]">Configuration</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12">
        <Stepper currentStep="zones" />
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-3xl font-bold text-[#222222]">Zones de collecte</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showZonesOnMap}
                  onChange={(e) => setShowZonesOnMap(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-[#717171]">Afficher zones sur carte</span>
              </label>
              <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
                Nouvelle Zone
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              <p className="text-[#717171] text-sm">
                Cliquez sur une zone pour la mettre en évidence sur la carte.
              </p>
              {zones.length === 0 ? (
                <p className="text-[#717171] py-4">Aucune zone. Créez-en une pour commencer.</p>
              ) : (
                zones.map((zone) => (
                  <ZoneCard
                    key={zone.id}
                    zone={zone}
                    points={collectionPoints}
                    camions={camions}
                    onEdit={openEdit}
                    onFocus={handleFocus}
                  />
                ))
              )}
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
              <div className="h-[400px] w-full">
                <MapContainer
                  center={CASABLANCA_CENTER}
                  zoom={DEFAULT_ZOOM}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {focusZoneId != null && typeof focusZoneId === 'number' && (
                    <MapFocus
                      zone={zones.find((z) => z.id === focusZoneId)}
                      points={points}
                    />
                  )}
                  {previewZone && <MapFocusPreview previewZone={previewZone} points={points} />}
                  {depot && (
                    <Marker
                      position={[depot.lat, depot.lng]}
                      icon={L.divIcon({
                        className: 'depot-marker',
                        html: '<div style="background:#dc3545;width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px">🏭</div>',
                        iconSize: [28, 28],
                        iconAnchor: [14, 14],
                      })}
                    />
                  )}
                  {(dechetteries || []).map((d) => (
                    <Marker key={d.id} position={[d.lat, d.lng]} />
                  ))}
                  {collectionPoints.map((p) => {
                    const isSelected = showModal && form.point_ids.includes(p.id)
                    const icon =
                      isSelected && form.couleur && SELECTED_POINT_ICONS[form.couleur]
                        ? SELECTED_POINT_ICONS[form.couleur]
                        : DEFAULT_POINT_ICON

                    return (
                      <Marker
                        key={p.id}
                        position={[p.lat, p.lng]}
                        icon={icon}
                        eventHandlers={{
                          click: () => {
                            if (!showModal) return
                            setForm((prev) => {
                              const already = prev.point_ids.includes(p.id)
                              const nextIds = already
                                ? prev.point_ids.filter((id) => id !== p.id)
                                : [...prev.point_ids, p.id]
                              const nextForm = { ...prev, point_ids: nextIds }
                              if (nextIds.length >= 1) {
                                setPreviewZone({
                                  point_ids: nextIds,
                                  couleur: nextForm.couleur,
                                  nom: nextForm.nom || 'Aperçu',
                                })
                              } else {
                                setPreviewZone(null)
                              }
                              return nextForm
                            })
                          },
                        }}
                      />
                    )
                  })}
                  {showZonesOnMap && previewZone && (() => {
                    const zonePoints = points.filter((p) =>
                      previewZone.point_ids.some((id) => id == p.id)
                    )
                    const buffered = buildZonePolygonFromPoints(zonePoints, 0.004)
                    if (!buffered || buffered.length < 3) return null
                    const center = centroid(zonePoints)
                    return (
                      <>
                        <Polygon
                          positions={buffered}
                          pathOptions={{
                            color: previewZone.couleur,
                            fillColor: previewZone.couleur,
                            fillOpacity: 0.15,
                            weight: 3,
                            opacity: 0.8,
                            dashArray: '6, 4',
                          }}
                        />
                        {center && (
                          <Marker
                            position={center}
                            icon={L.divIcon({
                              className: 'zone-label',
                              html: `<div style="background:${previewZone.couleur}44;border:2px solid ${previewZone.couleur};border-radius:8px;padding:4px 10px;font-weight:700;font-size:12px;color:${previewZone.couleur}">${previewZone.nom} (aperçu)</div>`,
                              iconAnchor: [0, 0],
                            })}
                          />
                        )}
                      </>
                    )
                  })()}
                  {showZonesOnMap &&
                    zones.map((zone) => {
                      const pointIds = zone.point_ids || zone.points || []
                      const zonePoints = points.filter((p) =>
                        pointIds.some((id) => id == p.id)
                      )
                      const buffered = buildZonePolygonFromPoints(zonePoints, 0.004)
                      if (!buffered || buffered.length < 3) return null
                      const center = centroid(zonePoints)
                      return (
                        <div key={zone.id}>
                          <Polygon
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
                          {center && (
                            <Marker
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
                          )}
                        </div>
                      )
                    })}
                </MapContainer>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-8">
            <Button variant="primary" onClick={onNext}>
              Suivant : Camions →
            </Button>
          </div>
        </div>
      </main>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={() => { setPreviewZone(null); setShowModal(false) }}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-6">
              {editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Nom</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50"
                  placeholder="Zone A - Centre Ville"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-2">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {ZONE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, couleur: c })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        form.couleur === c ? 'border-[#222] scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Couleur ${c}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">
                  Points de collecte
                </label>
                <div className="max-h-40 overflow-y-auto space-y-2 border border-[#EBEBEB] rounded-lg p-3">
                  {collectionPoints.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.point_ids.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm({ ...form, point_ids: [...form.point_ids, p.id] })
                          } else {
                            setForm({
                              ...form,
                              point_ids: form.point_ids.filter((id) => id !== p.id),
                            })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {p.nom || `Point ${p.id}`} ({p.volume ?? 0} kg)
                      </span>
                    </label>
                  ))}
                  {collectionPoints.length === 0 && (
                    <p className="text-sm text-[#717171]">Aucun point de collecte disponible.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">
                  Camions assignés
                </label>
                <select
                  multiple
                  value={form.camion_ids.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value))
                    setForm({ ...form, camion_ids: selected })
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] min-h-[80px]"
                >
                  {(camions || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      Camion {c.id} ({c.capacite} kg)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#717171] mt-1">
                  Maintenez Ctrl (ou Cmd) pour sélectionner plusieurs camions.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-6">
              <Button type="button" variant="primary" className="flex-1" onClick={handleSave}>
                {editingZone ? 'Enregistrer' : 'Créer'}
              </Button>
              <Button
                type="button"
                variant="secondary"
              >
                Fermer l'aperçu
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
