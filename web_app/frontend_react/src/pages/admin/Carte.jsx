/**
 * Carte & Planification - Flux VillePropre existant (points, camions, optimisation, résultats)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { ProjectProvider, useProject, getSaved, STORAGE_KEY } from '../../context/ProjectContext'
import Home from '../Home'
import PointsConfig from '../../components/configuration/PointsConfig'
import ZonesConfig from '../../components/configuration/ZonesConfig'
import CamionsConfig from '../../components/configuration/CamionsConfig'
import CreneauxConfig from '../../components/configuration/CreneauxConfig'
import ContraintesConfig from '../../components/configuration/ContraintesConfig'
import OptimizationLoader from '../../components/optimization/OptimizationLoader'
import ResultsView from '../../components/results/ResultsView'
import Button from '../../components/common/Button'

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.3 },
}

function CarteContent() {
  const {
    points,
    zones,
    camions,
    creneaux,
    setCreneaux,
    contraintes,
    setContraintes,
    planningResult,
    setPlanningResult,
    routesResult,
    setRoutesResult,
    depot,
    setDepot,
    dechetteries,
    loadProject,
    addDechetterie,
    removeDechetterie,
    addPoint,
    removePoint,
    addZone,
    updateZone,
    removeZone,
    addCamion,
    removeCamion,
    updateCamion,
  } = useProject()
  const [screen, setScreen] = useState(() => getSaved().screen || 'home')
  const [osmModalOpen, setOsmModalOpen] = useState(false)
  const [osmNodes, setOsmNodes] = useState([])
  const [osmFileName, setOsmFileName] = useState('')
  const [osmAmenityFilter, setOsmAmenityFilter] = useState('cafe')
  const [osmMaxPoints, setOsmMaxPoints] = useState(50)
  const [osmVolume, setOsmVolume] = useState(800)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          screen,
          points,
          zones,
          camions,
          creneaux,
          contraintes,
          planningResult: planningResult ?? null,
          routesResult: routesResult ?? null,
          depot: depot ?? null,
          dechetteries,
        })
      )
    } catch (_) {}
  }, [screen, points, zones, camions, creneaux, contraintes, planningResult, routesResult, depot, dechetteries])

  const handleMapClickAdd = (lat, lng) => {
    const nom = prompt('Nom du point') || `Point ${points.length + 1}`
    const volume = parseInt(prompt('Volume estimé (kg)', '1200'), 10) || 1200
    addPoint({ lat, lng, nom, volume, priorite: 'normale' })
  }
  const handleManualAdd = (data) => addPoint({ ...data, priorite: 'normale' })
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            loadProject(JSON.parse(ev.target.result))
            setTimeout(() => setScreen('points'), 120)
          } catch (err) {
            alert('Fichier invalide')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleImportOsmRandom = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.geojson'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target.result)
          const elements =
            Array.isArray(raw.elements) && raw.elements.length
              ? raw.elements
              : Array.isArray(raw.features)
                ? raw.features.map((f) => ({
                    type: 'node',
                    lat: f.geometry?.coordinates?.[1],
                    lon: f.geometry?.coordinates?.[0],
                    tags: f.properties || {},
                  }))
                : []
          const nodes = elements.filter(
            (el) => el && el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number'
          )
          if (!nodes.length) {
            alert('Aucun noeud OSM valide trouvé dans ce fichier.')
            return
          }
          setOsmNodes(nodes)
          setOsmFileName(file.name)
          const withAmenity = nodes.filter((n) => n.tags && (n.tags.amenity || n.tags.shop))
          const maxDefault = Math.min(50, withAmenity.length || nodes.length)
          setOsmMaxPoints(maxDefault || 10)
          setOsmAmenityFilter('cafe')
          setOsmVolume(800)
          setOsmModalOpen(true)
        } catch (err) {
          console.error(err)
          alert('Fichier OSM invalide ou non supporté.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleLoadTemplate = () => {
    fetch('/template_multi_camions.json')
      .then((r) => r.json())
      .then((data) => {
        loadProject(data)
        setScreen('points')
      })
      .catch(() => alert('Impossible de charger le template'))
  }

  const handleLoadTemplateAgadir = () => {
    fetch('/template_agadir_osm.json')
      .then((r) => r.json())
      .then((data) => {
        loadProject(data)
        setScreen('points')
      })
      .catch(() => alert('Impossible de charger le template Agadir'))
  }

  /** Génère 500 points de test (déterministe) + 20 camions + 3 déchetteries pour tester LNS en pratique */
  const handleLoadTest500 = () => {
    const centerLat = 30.42
    const centerLng = -9.6
    const pointsData = []
    let id = 1
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 25; col++) {
        if (id > 500) break
        const lat = centerLat + (row - 10) * 0.022 + (col % 5) * 0.002
        const lng = centerLng + (col - 12) * 0.025 + (row % 4) * 0.003
        const volume = 150 + ((id * 17) % 451)
        pointsData.push({
          id,
          lat,
          lng,
          nom: `Point test ${id}`,
          volume,
          priorite: 'normale',
        })
        id++
      }
    }
    const depotPoint = {
      id: 0,
      nom: 'Dépôt (test 500 pts)',
      lat: centerLat,
      lng: centerLng,
      volume: 0,
      priorite: 'normale',
    }
    const camionsData = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      capacite: 4000,
      cout_fixe: 100 + (i + 1) * 10,
      zones_assignees: [],
    }))
    const dechetteriesData = [
      { id: 1001, nom: 'Déchetterie Nord', lat: centerLat + 0.15, lng: centerLng, capacite_max: 50000 },
      { id: 1002, nom: 'Déchetterie Sud', lat: centerLat - 0.12, lng: centerLng - 0.08, capacite_max: 50000 },
      { id: 1003, nom: 'Déchetterie Est', lat: centerLat, lng: centerLng + 0.18, capacite_max: 50000 },
    ]
    const creneauxData = [
      { id: 1, jour: 'lundi', debut: '06:00', fin: '12:00', congestion: 1.1 },
      { id: 2, jour: 'mardi', debut: '06:00', fin: '12:00', congestion: 1.1 },
      { id: 3, jour: 'mercredi', debut: '06:00', fin: '12:00', congestion: 1.1 },
    ]
    loadProject({
      depot: depotPoint,
      points: pointsData,
      camions: camionsData,
      dechetteries: dechetteriesData,
      zones: [],
      creneaux: creneauxData,
    })
    setScreen('points')
  }

  /** Import des localisations depuis agadir_structures.json (format name/type/latitude/longitude, pas OSM) */
  const handleImportAgadirStructures = () => {
    fetch('/agadir_structures.json')
      .then((r) => {
        if (!r.ok) throw new Error('Fichier introuvable')
        return r.json()
      })
      .then((raw) => {
        const items = Array.isArray(raw) ? raw : []
        if (!items.length) {
          alert('Aucune structure dans agadir_structures.json')
          return
        }
        const pointsData = items.map((item, idx) => ({
          id: idx + 1,
          lat: Number(item.latitude),
          lng: Number(item.longitude),
          nom: item.name || `Structure ${idx + 1}`,
          volume: 800,
          priorite: 'normale',
          ...(item.type && { type: item.type }),
        })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        if (!pointsData.length) {
          alert('Aucune entrée avec latitude/longitude valides.')
          return
        }
        const depotLat = pointsData.reduce((s, p) => s + p.lat, 0) / pointsData.length
        const depotLng = pointsData.reduce((s, p) => s + p.lng, 0) / pointsData.length
        const depotPoint = {
          id: 0,
          nom: 'Dépôt (centre Agadir)',
          lat: depotLat,
          lng: depotLng,
          volume: 0,
          priorite: 'normale',
        }
        loadProject({
          depot: depotPoint,
          points: pointsData,
        })
        setScreen('points')
      })
      .catch((err) => {
        console.error(err)
        alert('Impossible de charger agadir_structures.json')
      })
  }

  return (
    <>
      {osmModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9998] p-4"
          onClick={() => setOsmModalOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[#222222] mb-1">
                  Importer un jeu de points OSM
                </h3>
                <p className="text-sm text-[#717171]">
                  Fichier : <span className="font-mono">{osmFileName || '—'}</span> ·{' '}
                  {osmNodes.length} nœuds chargés
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOsmModalOpen(false)}
                className="text-[#717171] hover:text-[#222222]"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">
                    Type de lieu (amenity / shop)
                  </label>
                  <input
                    type="text"
                    value={osmAmenityFilter}
                    onChange={(e) => setOsmAmenityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#EBEBEB] text-sm"
                    placeholder="cafe, restaurant, pharmacy, * pour tout"
                  />
                  <p className="text-xs text-[#717171] mt-1">
                    Exemple : <code>cafe</code>, <code>restaurant</code>,{' '}
                    <code>fast_food</code>. Utilisez <code>*</code> pour prendre tous les
                    amenity/shop.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <div>
                    <label className="block text-sm font-medium text-[#222222] mb-1">
                      Nombre maximum de points (échantillon aléatoire)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={osmNodes.length || 1}
                      value={osmMaxPoints}
                      onChange={(e) => {
                        const v = parseInt(e.target.value || '1', 10)
                        setOsmMaxPoints(
                          Number.isFinite(v) ? Math.max(1, Math.min(osmNodes.length || 1, v)) : 10
                        )
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-[#EBEBEB] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#222222] mb-1">
                      Volume moyen par point (kg)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={osmVolume}
                      onChange={(e) => {
                        const v = parseInt(e.target.value || '800', 10)
                        setOsmVolume(Number.isFinite(v) && v > 0 ? v : 800)
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-[#EBEBEB] text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-[260px] w-full rounded-xl border border-[#EBEBEB] overflow-hidden">
                  <MapContainer
                    center={[
                      osmNodes.reduce((s, n) => s + (n.lat || 0), 0) / (osmNodes.length || 1) || 30.42,
                      osmNodes.reduce((s, n) => s + (n.lon || 0), 0) / (osmNodes.length || 1) || -9.6,
                    ]}
                    zoom={12}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {osmNodes.slice(0, 200).map((n) => (
                      <Marker key={n.id} position={[n.lat, n.lon]} icon={new L.Icon.Default()} />
                    ))}
                  </MapContainer>
                </div>
                <p className="text-xs text-[#717171]">
                  La carte affiche jusqu&apos;à 200 points pour prévisualiser le fichier OSM.
                  L&apos;échantillon final utilisera vos paramètres ci-dessus.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOsmModalOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (!osmNodes.length) {
                    setOsmModalOpen(false)
                    return
                  }
                  const filt = osmAmenityFilter && osmAmenityFilter.trim() !== ''
                    ? osmAmenityFilter.trim()
                    : '*'
                  let candidates = osmNodes.filter((n) => n.tags && (n.tags.amenity || n.tags.shop))
                  if (filt !== '*') {
                    candidates = candidates.filter(
                      (n) => n.tags?.amenity === filt || n.tags?.shop === filt
                    )
                  }
                  if (!candidates.length) {
                    alert('Aucun point correspondant à ce filtre amenity/shop.')
                    return
                  }
                  const n = Math.max(
                    1,
                    Math.min(candidates.length, osmMaxPoints || candidates.length)
                  )
                  const baseVolume = osmVolume || 800
                  const shuffled = [...candidates].sort(() => Math.random() - 0.5)
                  const selected = shuffled.slice(0, n)

                  const pointsData = selected.map((n, idx) => ({
                    id: idx + 1,
                    lat: n.lat,
                    lng: n.lon,
                    nom:
                      n.tags?.name ||
                      `${n.tags?.amenity || n.tags?.shop || 'Point OSM'} #${idx + 1}`,
                    volume: baseVolume,
                    priorite: 'normale',
                  }))

                  const depotLat =
                    pointsData.reduce((s, p) => s + (p.lat || 0), 0) / pointsData.length
                  const depotLng =
                    pointsData.reduce((s, p) => s + (p.lng || 0), 0) / pointsData.length

                  const depotPoint = {
                    id: 0,
                    nom: 'Dépôt (centre OSM)',
                    lat: depotLat,
                    lng: depotLng,
                    volume: 0,
                    priorite: 'normale',
                  }

                  const dechetNodes = osmNodes.filter((n) =>
                    ['waste_disposal', 'recycling'].includes(n.tags?.amenity || '')
                  )
                  const dechetteriesData = dechetNodes.map((n, i) => ({
                    id: 200 + i,
                    nom:
                      n.tags?.name ||
                      `${
                        n.tags?.amenity === 'recycling'
                          ? 'Point recyclage'
                          : 'Déchetterie'
                      } OSM #${i + 1}`,
                    lat: n.lat,
                    lng: n.lon,
                    capacite_max: 50000,
                  }))

                  loadProject({
                    depot: depotPoint,
                    points: pointsData,
                    dechetteries: dechetteriesData,
                  })
                  setScreen('points')
                  setOsmModalOpen(false)
                }}
              >
                Générer et charger
              </Button>
            </div>
          </motion.div>
        </div>
      )}
      {screen === 'points' ? (
        <PointsConfig
          points={points}
          depot={depot}
          onDepotChange={setDepot}
          dechetteries={dechetteries}
          onAddDechetterie={addDechetterie}
          onRemoveDechetterie={removeDechetterie}
          onMapClickAdd={handleMapClickAdd}
          onManualAdd={handleManualAdd}
          onRemovePoint={removePoint}
          onRemovePoints={(ids) => ids.forEach((id) => removePoint(id))}
          onNext={() => setScreen('zones')}
          onBack={() => setScreen('home')}
          onImport={handleImport}
        />
      ) : screen === 'zones' ? (
        <ZonesConfig
          zones={zones}
          points={points}
          camions={camions}
          depot={depot}
          dechetteries={dechetteries}
          onAddZone={addZone}
          onUpdateZone={updateZone}
          onRemoveZone={removeZone}
          onNext={() => setScreen('camions')}
          onBack={() => setScreen('points')}
        />
      ) : (
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div key="home" {...PAGE_TRANSITION}>
              <Home
                onStart={() => setScreen('points')}
                onImport={handleImport}
                onLoadTemplate={handleLoadTemplate}
                onLoadTemplateAgadir={handleLoadTemplateAgadir}
                onImportOsmRandom={handleImportOsmRandom}
                onImportAgadirStructures={handleImportAgadirStructures}
                onLoadTest500={handleLoadTest500}
              />
            </motion.div>
          )}
          {screen === 'camions' && (
            <motion.div key="camions" {...PAGE_TRANSITION}>
              <CamionsConfig
                camions={camions}
                zones={zones}
                onAddCamion={addCamion}
                onUpdateCamion={updateCamion}
                onRemoveCamion={removeCamion}
                onNext={() => setScreen('creneaux')}
                onBack={() => setScreen('zones')}
              />
            </motion.div>
          )}
          {screen === 'creneaux' && (
            <motion.div key="creneaux" {...PAGE_TRANSITION}>
              <CreneauxConfig
                creneaux={creneaux}
                onCreneauxChange={setCreneaux}
                onNext={() => setScreen('contraintes')}
                onBack={() => setScreen('camions')}
              />
            </motion.div>
          )}
          {screen === 'contraintes' && (
            <motion.div key="contraintes" {...PAGE_TRANSITION}>
              <ContraintesConfig
                points={points}
                camions={camions}
                contraintes={contraintes}
                onContraintesChange={setContraintes}
                onNext={() => setScreen('optimization')}
                onBack={() => setScreen('creneaux')}
              />
            </motion.div>
          )}
          {screen === 'optimization' && (
            <motion.div key="optimization" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <OptimizationLoader
                points={points}
                zones={zones}
                camions={camions}
                depot={depot}
                dechetteries={dechetteries}
                creneaux={creneaux}
                contraintes={contraintes}
                onSuccess={(data) => {
                  setPlanningResult(data?.niveau3)
                  setRoutesResult(data?.routes)
                  setScreen('results')
                }}
                onBack={() => setScreen('contraintes')}
              />
            </motion.div>
          )}
          {screen === 'results' && (
            <motion.div key="results" {...PAGE_TRANSITION}>
              <ResultsView
                planning={planningResult}
                indicateurs={planningResult?.indicateurs}
                routes={routesResult}
                points={points}
                depot={depot || points?.[0]}
                dechetteries={dechetteries}
                zones={zones}
                camions={camions}
                creneaux={creneaux}
                contraintes={contraintes}
                onBack={() => {
                  setPlanningResult(null)
                  setRoutesResult(null)
                  setScreen('home')
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  )
}

export default function Carte() {
  return (
    <ProjectProvider>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Carte & Planification</h1>
        <p className="text-[var(--color-text-muted)]">Points, camions, créneaux, optimisation des routes</p>
      </div>
      <CarteContent />
    </ProjectProvider>
  )
}
