import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Truck, Clock, Map, BarChart3, Calendar, Download } from 'lucide-react'
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
  zones = [],
  camions = [],
  creneaux = [],
  contraintes = {},
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('carte')
  const [layerVisibility, setLayerVisibility] = useState({
    zones: true,
    points: true,
    trajets: true,
  })
  const hebdo = planning?.planification_hebdomadaire || {}
  const jours = Object.entries(hebdo)
  const routesList = routes?.routes ?? []
  const stats = routes?.statistiques ?? {}
  const techniqueGrandeInstance = stats.technique_grande_instance
  const nbIterationsLns = stats.nb_iterations_lns

  const depotId = depot?.id ?? 0
  const totalPointsCollecte = (points || []).filter(
    (p) => !p.isDepot && p.id !== depotId
  ).length
  const visitedPointIds = new Set()
  routesList.forEach((r) => {
    (r.waypoints || []).forEach((wp) => {
      if (wp.type_point === 'collecte' || wp.type === 'collecte') {
        if (wp.id != null && wp.id !== 0) visitedPointIds.add(wp.id)
      }
    })
  })
  const pointsVisites = visitedPointIds.size
  const couvertureReellePct =
    totalPointsCollecte > 0
      ? Math.round((pointsVisites / totalPointsCollecte) * 100)
      : null

  const routeCapacityDiagnostics = routesList.map((r, idx) => {
    const steps = Array.isArray(r.details_etapes) ? r.details_etapes : []
    let maxCharge = 0
    steps.forEach((s) => {
      if (typeof s.charge_apres === 'number' && !Number.isNaN(s.charge_apres)) {
        if (s.charge_apres > maxCharge) maxCharge = s.charge_apres
      }
    })
    const capacite = typeof r.capacite === 'number' ? r.capacite : null
    const ok = capacite == null ? true : maxCharge <= capacite + 1e-6
    return {
      camionId: r.camion_id,
      zoneId: r.zone_id,
      tourneeIndex: idx + 1,
      capacite,
      maxCharge,
      nbDechetterie: r.nb_visites_dechetterie ?? 0,
      ok,
    }
  })

  const tabs = [
    { id: 'carte', label: 'Carte', icon: Map },
    { id: 'planning', label: 'Planning', icon: Calendar },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 },
  ]

  const handleExportJson = useCallback(() => {
    const collectionPointIds = (points || [])
      .filter((p) => !p.isDepot && p.id !== (depot?.id ?? 0))
      .map((p) => p.id)
    const pointsNonVisitesIds = collectionPointIds.filter((id) => !visitedPointIds.has(id))

    const payload = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      description: 'Export complet VillePropre : données d\'entrée, planning et résultats des tournées pour analyse (ex. couverture)',
      donnees_entree: {
        depot: depot
          ? {
              id: depot.id,
              nom: depot.nom,
              lat: depot.lat,
              lng: depot.lng,
              x: depot.x,
              y: depot.y,
            }
          : null,
        points: (points || []).map((p) => ({
          id: p.id,
          nom: p.nom,
          lat: p.lat,
          lng: p.lng,
          x: p.x,
          y: p.y,
          volume: p.volume,
          isDepot: p.isDepot,
          zone_id: p.zone_id,
        })),
        camions: (camions || []).map((c) => ({
          id: c.id,
          nom: c.nom,
          capacite: c.capacite,
          cout_fixe: c.cout_fixe,
          zones_assignees: c.zones_assignees ?? c.zones_accessibles ?? [],
        })),
        zones: (zones || []).map((z) => ({
          id: z.id,
          nom: z.nom,
          point_ids: z.point_ids ?? z.points ?? [],
          volume_moyen: z.volume_moyen,
          centre: z.centre,
        })),
        dechetteries: (dechetteries || []).map((d) => ({
          id: d.id,
          nom: d.nom,
          lat: d.lat,
          lng: d.lng,
          capacite_max: d.capacite_max,
        })),
        creneaux: (creneaux || []).map((c) => ({
          id: c.id,
          jour: c.jour,
          debut: c.debut,
          fin: c.fin,
          congestion: c.congestion,
        })),
        contraintes: contraintes || {},
      },
      planning: planning || null,
      resultats_tournees: routes
        ? {
            routes: routes.routes,
            statistiques: routes.statistiques,
            depot: routes.depot,
            dechetteries: routes.dechetteries,
          }
        : null,
      analyse_couverture: {
        total_points_collecte: totalPointsCollecte,
        points_visites_count: pointsVisites,
        points_visites_ids: Array.from(visitedPointIds).sort((a, b) => a - b),
        points_non_visites_ids: pointsNonVisitesIds.sort((a, b) => a - b),
        couverture_reelle_pct: couvertureReellePct,
        nb_routes: routesList.length,
        technique_grande_instance: techniqueGrandeInstance ?? null,
        nb_iterations_lns: nbIterationsLns ?? null,
      },
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `villepropre-export-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [
    points,
    depot,
    camions,
    zones,
    dechetteries,
    creneaux,
    contraintes,
    planning,
    routes,
    totalPointsCollecte,
    pointsVisites,
    visitedPointIds,
    couvertureReellePct,
    routesList.length,
    techniqueGrandeInstance,
    nbIterationsLns,
  ])

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-[#EBEBEB] px-8 py-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-[#222222]">Planning généré</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportJson}
              title="Télécharger un JSON avec toutes les données d'entrée, le planning et les résultats (pour analyse couverture)"
            >
              Exporter JSON
            </Button>
            <Button variant="secondary" onClick={onBack}>
              ← Nouveau projet
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        {indicateurs && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
          >
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm">
              <p className="text-sm text-[#717171]">Occupation des créneaux</p>
              <p className="text-2xl font-bold text-[#222222]">{indicateurs.taux_occupation ?? 0}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm">
              <p className="text-sm text-[#717171]">Utilisation du parc</p>
              <p className="text-2xl font-bold text-[#222222]">{indicateurs.taux_utilisation_parc ?? 0}%</p>
            </div>
            <div
              className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm"
              title="Part des points de collecte réellement visités par les tournées (carte)"
            >
              <p className="text-sm text-[#717171]">
                Points visités (carte)
              </p>
              <p className="text-2xl font-bold text-[#222222]">
                {routesList.length > 0 && totalPointsCollecte > 0 ? (
                  <>
                    {couvertureReellePct}%
                    <span className="text-sm font-normal text-[#717171] ml-1">
                      ({pointsVisites}/{totalPointsCollecte})
                    </span>
                  </>
                ) : (
                  indicateurs?.couverture_collecte != null ? `${indicateurs.couverture_collecte}%` : '—'
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm" title="Toutes les affectations respectent les contraintes temporelles">
              <p className="text-sm text-[#717171]">Respect contraintes</p>
              <p className="text-2xl font-bold text-[#00A699]">{indicateurs.respect_horaires ?? 100}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#EBEBEB] shadow-sm">
              <p className="text-sm text-[#717171]">Congestion moyenne</p>
              <p className="text-2xl font-bold text-[#222222]">{indicateurs.congestion_moyenne ?? 1}</p>
            </div>
            {techniqueGrandeInstance && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-6 bg-[#E8F5E9] rounded-xl p-4 border border-[#C8E6C9]">
                <p className="text-sm text-[#2E7D32] font-medium">Optimisation grande instance</p>
                <p className="text-[#222222]">Technique : {techniqueGrandeInstance}</p>
                {nbIterationsLns != null && (
                  <p className="text-sm text-[#717171]">Itérations LNS : {nbIterationsLns}</p>
                )}
              </div>
            )}
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
                  <>
                    <MapWithRoutes
                      routes={routes}
                      points={points}
                      depot={depot}
                      dechetteries={dechetteries}
                      zones={zones}
                      layerVisibility={layerVisibility}
                      animate={true}
                    />
                    <div className="flex flex-wrap items-center gap-4 pt-3 text-sm text-[#717171]">
                      <span className="font-medium">Afficher/Masquer :</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={layerVisibility.zones}
                          onChange={(e) =>
                            setLayerVisibility((v) => ({ ...v, zones: e.target.checked }))
                          }
                          className="rounded border-gray-300"
                        />
                        Zones
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={layerVisibility.points}
                          onChange={(e) =>
                            setLayerVisibility((v) => ({ ...v, points: e.target.checked }))
                          }
                          className="rounded border-gray-300"
                        />
                        Points
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={layerVisibility.trajets}
                          onChange={(e) =>
                            setLayerVisibility((v) => ({ ...v, trajets: e.target.checked }))
                          }
                          className="rounded border-gray-300"
                        />
                        Trajets
                      </label>
                    </div>
                  </>
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
                        {(() => {
                          const d = routes.statistiques.distance_totale
                          if (d == null) return '—'
                          const km = d >= 1000 ? d / 1000 : d
                          return `${km.toFixed(1)} km`
                        })()}
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
                {routeCapacityDiagnostics.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#222222]">
                      Contrôle capacité des camions
                    </h4>
                    <p className="text-sm text-[#717171]">
                      Vérification que la charge maximale entre deux passages en déchetterie ne dépasse
                      jamais la capacité du camion.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {routeCapacityDiagnostics.map((d, idx) => (
                        <div
                          key={`tournee-${idx}-${d.camionId ?? ''}-${d.zoneId ?? ''}`}
                          className={`p-4 rounded-xl border ${
                            d.ok
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-[#222222] mb-1">
                            {routeCapacityDiagnostics.length > 20
                              ? `Tournée n°${d.tourneeIndex}`
                              : `Camion ${d.camionId ?? '—'}`}
                            {d.zoneId != null && (
                              <span className="text-[#717171] font-normal"> · Zone {d.zoneId}</span>
                            )}
                          </p>
                          {routeCapacityDiagnostics.length > 20 && (
                            <p className="text-sm text-[#717171]">Camion : {d.camionId ?? '—'}</p>
                          )}
                          <p className="text-sm text-[#717171]">
                            Capacité : {d.capacite != null ? `${d.capacite} kg` : '—'}
                          </p>
                          <p className="text-sm text-[#717171]">
                            Charge max sur la tournée : {Math.round(d.maxCharge)} kg
                          </p>
                          <p className="text-sm text-[#717171]">
                            Passages en déchetterie : {d.nbDechetterie}
                          </p>
                          <p
                            className={`mt-2 text-sm font-semibold ${
                              d.ok ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {d.ok ? 'Capacité respectée' : 'DÉPASSEMENT détecté'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(indicateurs || routesList.length > 0) && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-semibold text-[#222222] mb-2">Indicateurs du planning</h4>
                    <ul className="space-y-1 text-sm text-[#717171]">
                      {routesList.length > 0 && totalPointsCollecte > 0 && (
                        <li className="font-medium text-[#222222]">
                          Points visités par les tournées : {pointsVisites} / {totalPointsCollecte} ({couvertureReellePct}%)
                        </li>
                      )}
                      {indicateurs && (
                        <>
                          <li>Occupation des créneaux : {indicateurs.taux_occupation ?? 0}%</li>
                          <li>Utilisation du parc : {indicateurs.taux_utilisation_parc ?? 0}%</li>
                          <li>Couverture planning (zones/créneaux) : {indicateurs.couverture_collecte ?? 100}%</li>
                          <li>Respect des contraintes : {indicateurs.respect_horaires ?? 100}%</li>
                          <li>Congestion moyenne : {indicateurs.congestion_moyenne ?? 1}</li>
                          <li>Retard moyen : {indicateurs.retard_moyen ?? 0} min</li>
                        </>
                      )}
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
