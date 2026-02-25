import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import Button from '../common/Button'
import {
  prepareDataForApi,
  apiNiveau1,
  apiNiveau2,
  apiNiveau3,
  apiRoutesOptimiser,
} from '../../utils/api'

const STEPS = [
  { id: 'niveau1', label: 'Calcul des distances' },
  { id: 'niveau2', label: 'Affectation des zones' },
  { id: 'niveau3', label: 'Génération du planning' },
  { id: 'routes', label: 'Optimisation des routes (OSRM)' },
]

export default function OptimizationLoader({
  points,
  camions,
  depot,
  dechetteries,
  creneaux,
  contraintes,
  onSuccess,
  onBack,
}) {
  const [step, setStep] = useState('running')
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [error, setError] = useState(null)

  useEffect(() => {
    runOptimization()
  }, [])

  async function runOptimization() {
    setError(null)
    setStep('running')

    const data = prepareDataForApi(points, camions, depot || points?.[0], dechetteries)
    if (!data || !data.points?.length || !data.camions?.length || !data.zones?.length) {
      setError('Données insuffisantes. Vérifiez points, camions et zones.')
      setStep('error')
      return
    }

    if (!creneaux?.length) {
      setError('Configurez les créneaux horaires avant de lancer l\'optimisation.')
      setStep('error')
      return
    }

    try {
      setCurrentStepIndex(0)
      await apiNiveau1(data.points, data.connexions, data.dechetteries)

      setCurrentStepIndex(1)
      const n2 = await apiNiveau2({
        points: data.points,
        connexions: data.connexions,
        dechetteries: data.dechetteries,
        camions: data.camions,
        zones: data.zones,
        zones_incompatibles: [],
      })

      setCurrentStepIndex(2)
      const n3 = await apiNiveau3({
        points: data.points,
        connexions: data.connexions,
        dechetteries: data.dechetteries,
        camions: data.camions,
        zones: data.zones,
        creneaux,
        contraintes: contraintes || {},
        horizon_jours: 7,
        use_osrm: false,
      })

      setCurrentStepIndex(3)
      let routes = null
      try {
        console.log('[Optimization] Étape 4: apiRoutesOptimiser START, depot:', depot?.id, 'points:', points?.length, 'camions:', camions?.length)
        // use_osrm: false → backend utilise distances euclidiennes (rapide, comme ancienne version sans OSRM)
        // L'affichage des routes réelles se fait côté frontend via OSRM Route API (MapWithRoutes)
        const t0 = Date.now()
        routes = await apiRoutesOptimiser(
          depot || points?.[0],
          points,
          dechetteries || [],
          camions,
          false
        )
        console.log('[Optimization] apiRoutesOptimiser OK en', Date.now() - t0, 'ms, routes:', routes?.routes?.length)
      } catch (e) {
        console.error('[Optimization] apiRoutesOptimiser ERROR:', e)
        console.warn('Routes API:', e?.message)
      }

      setStep('success')
      setTimeout(() => onSuccess({ niveau2: n2, niveau3: n3, routes }), 1500)
    } catch (err) {
      setError(err?.message || 'Erreur lors de l\'optimisation')
      setStep('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="bg-white border-b border-[#EBEBEB] px-8 py-6">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button onClick={onBack} className="text-[#717171] hover:text-[#222222] font-medium">
            ← Retour
          </button>
          <h1 className="text-xl font-semibold text-[#222222]">Optimisation</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-8 min-h-[400px]">
        <AnimatePresence mode="wait">
          {step === 'running' && (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-[#EBEBEB] p-8 overflow-hidden">
                {/* Animation de chargement moderne */}
                <div className="relative flex justify-center mb-8">
                  <div className="relative">
                    <motion.div
                      className="w-24 h-24 rounded-full border-4 border-[#FF5A5F]/20"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-[#FF5A5F]"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-[#FF5A5F]" />
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-[#222222] text-center mb-1">
                  Optimisation en cours...
                </h2>
                <p className="text-[#717171] text-center text-sm mb-8">
                  Analyse des contraintes temporelles
                </p>

                <div className="space-y-3">
                  {STEPS.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-3 p-4 rounded-xl transition-colors duration-300 ${
                        i < currentStepIndex
                          ? 'bg-green-50 border border-green-200'
                          : i === currentStepIndex
                            ? 'bg-[#FF5A5F]/10 border-2 border-[#FF5A5F]/30'
                            : 'bg-gray-50 border border-gray-100'
                      }`}
                    >
                      {i < currentStepIndex ? (
                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                      ) : i === currentStepIndex ? (
                        <Loader2 className="w-6 h-6 text-[#FF5A5F] animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      )}
                      <span
                        className={
                          i <= currentStepIndex ? 'font-semibold text-[#222222]' : 'text-[#717171]'
                        }
                      >
                        {s.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-[#EBEBEB] p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="w-20 h-20 text-[#00A699] mx-auto mb-4" />
                </motion.div>
                <h2 className="text-2xl font-bold text-[#222222] mb-2">
                  Optimisation terminée !
                </h2>
                <p className="text-[#717171] mb-2">Planning généré avec succès</p>
                <p className="text-sm text-[#00A699] animate-pulse">Redirection...</p>
              </div>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-[#EBEBEB] p-8 text-center">
                <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-[#222222] mb-2">Erreur</h2>
                <p className="text-[#717171] mb-6">{error}</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button variant="secondary" onClick={onBack}>
                    ← Retour
                  </Button>
                  <Button variant="primary" onClick={() => runOptimization()}>
                    Réessayer
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
