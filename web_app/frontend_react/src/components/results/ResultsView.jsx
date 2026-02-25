import { useState } from 'react'
import { motion } from 'framer-motion'
import { Truck, Clock, Map, BarChart3, Calendar } from 'lucide-react'
import Button from '../common/Button'
import MapWithRoutes from './MapWithRoutes'

const JOURS_LABELS = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
}

export default function ResultsView({
  planning,
  indicateurs,
  routes,
  points,
  depot,
  dechetteries,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('carte')
  const hebdo = planning?.planification_hebdomadaire || {}
  const jours = Object.entries(hebdo)

  const tabs = [
    { id: 'carte', label: 'Carte', icon: Map },
    { id: 'planning', label: 'Planning', icon: Calendar },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-[#EBEBEB] px-8 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-[#222222]">Planning généré</h1>
          <Button variant="secondary" onClick={onBack}>
            ← Nouveau projet
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        {indicateurs && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
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

        <div className="bg-white rounded-2xl shadow-sm border border-[#EBEBEB] overflow-hidden">
          <div className="flex border-b border-[#EBEBEB]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#FF5A5F] border-b-2 border-[#FF5A5F] bg-[#FF5A5F]/5'
                    : 'text-[#717171] hover:text-[#222222]'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 min-h-[400px]">
            {activeTab === 'carte' && (
              <motion.div
                key="carte"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-[#222222]">
                  Chemins calculés par les 3 niveaux
                </h3>
                <p className="text-sm text-[#717171]">
                  Visualisation des routes optimisées (Dépôt → Collecte → Déchetterie)
                </p>
                {routes?.routes?.length > 0 ? (
                  <MapWithRoutes
                    routes={routes}
                    points={points}
                    depot={depot}
                    dechetteries={dechetteries}
                    animate={true}
                  />
                ) : (
                  <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-xl text-[#717171]">
                    Aucune route optimisée disponible
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'planning' && (
              <motion.div
                key="planning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 max-h-[600px] overflow-y-auto"
              >
                {jours.map(([jour, collections]) => (
                  <div key={jour} className="border-b border-[#EBEBEB] pb-4 last:border-0">
                    <h3 className="text-lg font-bold text-[#222222] mb-3 capitalize">
                      {JOURS_LABELS[jour] || jour}
                    </h3>
                    {(!collections || collections.length === 0) ? (
                      <p className="text-[#717171] py-2">Aucune collecte planifiée</p>
                    ) : (
                      <div className="space-y-2">
                        {collections.map((col, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl"
                          >
                            <Truck className="w-5 h-5 text-[#FF5A5F]" />
                            <div>
                              <span className="font-semibold">Camion {col.camion_id}</span>
                              <span className="text-[#717171] mx-2">→</span>
                              <span>Zone {col.zone_id}</span>
                            </div>
                            <div className="flex gap-4 text-sm text-[#717171]">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {col.creneau?.debut} – {col.creneau?.fin}
                              </span>
                              <span>⏱️ {col.duree_totale} min</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {routes?.statistiques && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-[#717171]">Distance totale</p>
                      <p className="text-xl font-bold text-[#222222]">
                        {routes.statistiques.distance_totale?.toFixed(1) ?? '-'} km
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-[#717171]">Volume total collecté</p>
                      <p className="text-xl font-bold text-[#222222]">
                        {routes.statistiques.volume_total_collecte ?? '-'} kg
                      </p>
                    </div>
                  </div>
                )}
                {indicateurs && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-semibold text-[#222222] mb-2">Indicateurs du planning</h4>
                    <ul className="space-y-1 text-sm text-[#717171]">
                      <li>Taux d&apos;occupation : {indicateurs.taux_occupation ?? 0}%</li>
                      <li>Respect des horaires : {indicateurs.respect_horaires ?? 100}%</li>
                      <li>Congestion moyenne : {indicateurs.congestion_moyenne ?? 1}</li>
                      <li>Retard moyen : {indicateurs.retard_moyen ?? 0} min</li>
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
