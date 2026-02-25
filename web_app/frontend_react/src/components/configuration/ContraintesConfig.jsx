import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Moon, Coffee, Clock } from 'lucide-react'
import Button from '../common/Button'
import Card from '../common/Card'
import Stepper from '../common/Stepper'

export default function ContraintesConfig({
  points,
  camions,
  contraintes,
  onContraintesChange,
  onNext,
  onBack,
}) {
  const zones = (points || []).filter((p) => !p.isDepot)
  const [fenetres, setFenetres] = useState([])
  const [pauses, setPauses] = useState([])
  const [zonesNuit, setZonesNuit] = useState([])
  const [pauseDefaut, setPauseDefaut] = useState({ debut: '12:00', duree: 1 })

  useEffect(() => {
    setFenetres(contraintes?.fenetres_zone || [])
    setPauses(contraintes?.pauses_obligatoires || [])
    setZonesNuit(contraintes?.zones_interdites_nuit || [])
  }, [contraintes])

  const getFenetre = (zoneId) =>
    fenetres.find((f) => f.zone_id === zoneId) || { zone_id: zoneId, debut: '06:00', fin: '20:00' }

  const updateFenetre = (zoneId, debut, fin) => {
    const rest = fenetres.filter((f) => f.zone_id !== zoneId)
    setFenetres([...rest, { zone_id: zoneId, debut, fin }])
  }

  const toggleZoneNuit = (zoneId) => {
    setZonesNuit((prev) =>
      prev.includes(zoneId) ? prev.filter((z) => z !== zoneId) : [...prev, zoneId]
    )
  }

  const appliquerPauseATous = () => {
    const newPauses = (camions || []).map((c) => ({
      camion_id: c.id,
      debut: pauseDefaut.debut,
      duree: pauseDefaut.duree,
    }))
    setPauses(newPauses)
  }

  const handleNext = () => {
    // Persist fenetres for all zones (include defaults)
    const fenetresFinal = zones.length
      ? zones.map((z) => {
          const f = getFenetre(z.id)
          return { zone_id: z.id, debut: f.debut, fin: f.fin }
        })
      : fenetres
    onContraintesChange({
      fenetres_zone: fenetresFinal,
      pauses_obligatoires: pauses,
      zones_interdites_nuit: zonesNuit,
    })
    onNext()
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-[#EBEBEB] px-8 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <button onClick={onBack} className="text-[#717171] hover:text-[#222222]">
            ← Retour
          </button>
          <h1 className="text-xl font-semibold text-[#222222]">Configuration</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12">
        <Stepper currentStep="points" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div>
            <h2 className="text-3xl font-bold text-[#222222] mb-2">
              Règles spéciales à respecter
            </h2>
            <p className="text-[#717171]">
              Définissez les contraintes temporelles pour l&apos;optimisation
            </p>
          </div>

          {/* Zones interdites la nuit */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Moon className="w-6 h-6 text-[#FF5A5F]" />
              <h3 className="text-lg font-semibold text-[#222222]">
                Zones résidentielles (interdites la nuit 22h-6h)
              </h3>
            </div>
            <p className="text-sm text-[#717171] mb-4">
              Cochez les zones où la collecte est interdite la nuit (quartiers résidentiels)
            </p>
            {zones.length === 0 ? (
              <p className="text-[#717171] py-4">Aucun point de collecte. Configurez les points d&apos;abord.</p>
            ) : (
              <div className="space-y-3">
                {zones.map((z) => (
                  <label
                    key={z.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={zonesNuit.includes(z.id)}
                      onChange={() => toggleZoneNuit(z.id)}
                      className="w-5 h-5 rounded border-gray-300 text-[#FF5A5F] focus:ring-[#FF5A5F]"
                    />
                    <span className="font-medium">{z.nom || `Point ${z.id}`}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>

          {/* Pauses déjeuner */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Coffee className="w-6 h-6 text-[#FF5A5F]" />
              <h3 className="text-lg font-semibold text-[#222222]">
                Pauses déjeuner obligatoires
              </h3>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Début</label>
                <input
                  type="time"
                  value={pauseDefaut.debut}
                  onChange={(e) => setPauseDefaut({ ...pauseDefaut, debut: e.target.value })}
                  className="px-4 py-2 rounded-lg border border-[#EBEBEB]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Durée (h)</label>
                <input
                  type="number"
                  min="0.5"
                  max="3"
                  step="0.5"
                  value={pauseDefaut.duree}
                  onChange={(e) =>
                    setPauseDefaut({ ...pauseDefaut, duree: parseFloat(e.target.value) || 1 })
                  }
                  className="px-4 py-2 rounded-lg border border-[#EBEBEB] w-20"
                />
              </div>
              <Button variant="secondary" onClick={appliquerPauseATous} disabled={!camions?.length}>
                Appliquer à tous les camions
              </Button>
            </div>
            {pauses.length > 0 && (
              <p className="text-sm text-[#00A699] mt-3">✓ Pauses appliquées à {pauses.length} camion(s)</p>
            )}
          </Card>

          {/* Fenêtres horaires par zone */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-[#FF5A5F]" />
              <h3 className="text-lg font-semibold text-[#222222]">
                Fenêtres horaires par zone
              </h3>
            </div>
            <p className="text-sm text-[#717171] mb-4">
              Heures autorisées pour la collecte dans chaque zone
            </p>
            {zones.length === 0 ? (
              <p className="text-[#717171] py-4">Aucun point de collecte.</p>
            ) : (
              <div className="space-y-3">
                {zones.map((z) => {
                  const f = getFenetre(z.id)
                  return (
                    <div
                      key={z.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl"
                    >
                      <span className="font-medium">{z.nom || `Point ${z.id}`}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={f.debut}
                          onChange={(e) => updateFenetre(z.id, e.target.value, f.fin)}
                          className="px-3 py-2 rounded-lg border border-[#EBEBEB]"
                        />
                        <span className="text-[#717171]">–</span>
                        <input
                          type="time"
                          value={f.fin}
                          onChange={(e) => updateFenetre(z.id, f.debut, e.target.value)}
                          className="px-3 py-2 rounded-lg border border-[#EBEBEB]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Navigation */}
          <div className="flex justify-between pt-8">
            <Button variant="ghost" onClick={onBack}>
              ← Retour
            </Button>
            <Button variant="primary" onClick={handleNext}>
              Lancer l&apos;optimisation →
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
