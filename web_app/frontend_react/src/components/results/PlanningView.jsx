import { motion } from 'framer-motion'
import { Truck, Clock } from 'lucide-react'
import Button from '../common/Button'

const JOURS_LABELS = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
}

export default function PlanningView({ planning, indicateurs, onBack }) {
  const hebdo = planning?.planification_hebdomadaire || {}
  const jours = Object.entries(hebdo)

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-[#EBEBEB] px-8 py-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-[#222222]">Planning généré</h1>
          <Button variant="secondary" onClick={onBack}>
            ← Nouveau projet
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-12">
        {indicateurs && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12"
          >
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm">
              <p className="text-sm text-[#717171]">Taux occupation</p>
              <p className="text-2xl font-bold text-[#222222]">{indicateurs.taux_occupation ?? 0}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm">
              <p className="text-sm text-[#717171]">Respect horaires</p>
              <p className="text-2xl font-bold text-[#00A699]">{indicateurs.respect_horaires ?? 100}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm">
              <p className="text-sm text-[#717171]">Congestion moyenne</p>
              <p className="text-2xl font-bold text-[#222222]">{indicateurs.congestion_moyenne ?? 1}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm">
              <p className="text-sm text-[#717171]">Retard moyen</p>
              <p className="text-2xl font-bold text-[#222222]">{indicateurs.retard_moyen ?? 0} min</p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-8"
        >
          {jours.map(([jour, collections]) => (
            <div key={jour} className="bg-white rounded-xl p-6 shadow-sm border border-[#EBEBEB]">
              <h2 className="text-xl font-bold text-[#222222] mb-4 capitalize">
                {JOURS_LABELS[jour] || jour}
              </h2>

              {(!collections || collections.length === 0) ? (
                <p className="text-[#717171] py-4">Aucune collecte planifiée</p>
              ) : (
                <div className="space-y-3">
                  {collections.map((col, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl hover:shadow-sm transition-shadow"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="w-5 h-5 text-[#FF5A5F]" />
                          <span className="font-semibold">Camion {col.camion_id}</span>
                          <span className="text-[#717171]">→</span>
                          <span>Zone {col.zone_id}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-[#717171] ml-7">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {col.creneau?.debut} – {col.creneau?.fin}
                          </span>
                          <span>⏱️ {col.duree_totale} minutes</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  )
}
