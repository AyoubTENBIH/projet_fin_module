import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProjectProvider, useProject, getSaved, STORAGE_KEY } from './context/ProjectContext'
import Home from './pages/Home'
import PointsConfig from './components/configuration/PointsConfig'
import CamionsConfig from './components/configuration/CamionsConfig'
import CreneauxConfig from './components/configuration/CreneauxConfig'
import ContraintesConfig from './components/configuration/ContraintesConfig'
import OptimizationLoader from './components/optimization/OptimizationLoader'
import ResultsView from './components/results/ResultsView'

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.3 },
}

function AppContent() {
  const { points, camions, creneaux, setCreneaux, contraintes, setContraintes, planningResult, setPlanningResult, routesResult, setRoutesResult, depot, setDepot, dechetteries, loadProject, addDechetterie, removeDechetterie, addPoint, removePoint, addCamion, removeCamion, updateCamion } = useProject()
  const [screen, setScreen] = useState(() => (getSaved().screen || 'home'))

  // Persister l'état dans localStorage pour survivre au refresh
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        screen,
        points,
        camions,
        creneaux,
        contraintes,
        planningResult: planningResult ?? null,
        routesResult: routesResult ?? null,
        depot: depot ?? null,
        dechetteries,
      }))
    } catch (_) {}
  }, [screen, points, camions, creneaux, contraintes, planningResult, routesResult, depot, dechetteries])

  const handleMapClickAdd = (lat, lng) => {
    const nom = prompt('Nom du point (ex: Quartier Nord)') || `Point ${points.length + 1}`
    const volume = parseInt(prompt('Volume estimé (kg)', '1200'), 10) || 1200
    addPoint({ lat, lng, nom, volume, priorite: 'normale' })
  }

  const handleManualAdd = (data) => {
    addPoint({ ...data, priorite: 'normale' })
  }

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
            const data = JSON.parse(ev.target.result)
            if (process.env.NODE_ENV === 'development') {
              console.log('[Import] Données reçues:', { points: data.points?.length, depot: !!data.depot, dechetteries: data.dechetteries?.length, camions: data.camions?.length })
            }
            loadProject(data)
            // Délai pour que React committe les state (points, depot, etc.) avant d'afficher l'écran points
            setTimeout(() => setScreen('points'), 120)
          } catch (err) {
            console.error('[Import] Erreur:', err)
            alert('Fichier invalide : ' + (err?.message || ''))
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
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
          onNext={() => setScreen('camions')}
          onBack={() => setScreen('home')}
          onImport={handleImport}
        />
      ) : (
    <AnimatePresence mode="wait">
      {screen === 'home' && (
        <motion.div key="home" {...PAGE_TRANSITION}>
          <Home
            onStart={() => setScreen('points')}
            onImport={() => {
              handleImport()
            }}
          />
        </motion.div>
      )}

      {screen === 'camions' && (
        <motion.div key="camions" {...PAGE_TRANSITION}>
          <CamionsConfig
            camions={camions}
            onAddCamion={addCamion}
            onUpdateCamion={updateCamion}
            onRemoveCamion={removeCamion}
            onNext={() => setScreen('creneaux')}
            onBack={() => setScreen('points')}
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
        <motion.div
          key="optimization"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <OptimizationLoader
            points={points}
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

export default function App() {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  )
}
