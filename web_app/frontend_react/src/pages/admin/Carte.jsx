/**
 * Carte & Planification - Flux VillePropre existant (points, camions, optimisation, résultats)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProjectProvider, useProject, getSaved, STORAGE_KEY } from '../../context/ProjectContext'
import Home from '../Home'
import PointsConfig from '../../components/configuration/PointsConfig'
import ZonesConfig from '../../components/configuration/ZonesConfig'
import CamionsConfig from '../../components/configuration/CamionsConfig'
import CreneauxConfig from '../../components/configuration/CreneauxConfig'
import ContraintesConfig from '../../components/configuration/ContraintesConfig'
import OptimizationLoader from '../../components/optimization/OptimizationLoader'
import ResultsView from '../../components/results/ResultsView'

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
          const nodes = elements.filter((el) => el && el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number')
          if (!nodes.length) {
            alert('Aucun noeud OSM valide trouvé dans ce fichier.')
            return
          }
          const amenityFilter = prompt(
            'Type de lieu à utiliser comme points de collecte (ex: cafe, pharmacy, * pour tous les amenity/shop)',
            'cafe'
          )
          const filt = amenityFilter && amenityFilter.trim() !== '' ? amenityFilter.trim() : '*'
          let candidates = nodes.filter((n) => n.tags && (n.tags.amenity || n.tags.shop))
          if (filt !== '*') {
            candidates = candidates.filter(
              (n) => n.tags?.amenity === filt || n.tags?.shop === filt
            )
          }
          if (!candidates.length) {
            alert('Aucun point correspondant à ce filtre amenity/shop.')
            return
          }
          const maxDefault = Math.min(50, candidates.length)
          const nStr = prompt(
            `Nombre maximum de points à échantillonner (1–${candidates.length})`,
            String(maxDefault)
          )
          const nVal = parseInt(nStr || String(maxDefault), 10)
          const n = Number.isFinite(nVal)
            ? Math.max(1, Math.min(candidates.length, nVal))
            : maxDefault

          const volumeStr = prompt('Volume moyen par point (kg)', '800')
          const baseVolume = parseInt(volumeStr || '800', 10) || 800

          const shuffled = [...candidates].sort(() => Math.random() - 0.5)
          const selected = shuffled.slice(0, n)

          const pointsData = selected.map((n, idx) => ({
            id: idx + 1,
            lat: n.lat,
            lng: n.lon,
            nom: n.tags?.name || `${n.tags?.amenity || n.tags?.shop || 'Point OSM'} #${idx + 1}`,
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

          const dechetNodes = nodes.filter((n) =>
            ['waste_disposal', 'recycling'].includes(n.tags?.amenity || '')
          )
          const dechetteriesData = dechetNodes.map((n, i) => ({
            id: 200 + i,
            nom:
              n.tags?.name ||
              `${n.tags?.amenity === 'recycling' ? 'Point recyclage' : 'Déchetterie'} OSM #${i + 1}`,
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

  return (
    <>
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
