import { useState, useEffect } from 'react'
import { ecoAgadirApi } from '../../utils/ecoAgadirApi'

export default function Dashboard() {
  const [kpi, setKpi] = useState(null)
  const [plannings, setPlannings] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    Promise.all([
      ecoAgadirApi.stats.dashboard(),
      ecoAgadirApi.planning.list({
        date_from: new Date().toISOString().slice(0, 10),
        date_to: new Date().toISOString().slice(0, 10),
      }),
      ecoAgadirApi.users.list({ role: 'chauffeur' }),
    ])
      .then(([dash, pl, us]) => {
        setKpi(dash)
        setPlannings(pl)
        setUsers(us)
      })
      .catch(console.error)
  }, [])

  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]))

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="🚛 Camions actifs"
          value={kpi ? `${kpi.camions_actifs} / ${kpi.camions_total}` : '-'}
          sub={kpi?.camions_total ? Math.round((100 * kpi.camions_actifs) / kpi.camions_total) + '%' : ''}
        />
        <KpiCard
          title="👥 Chauffeurs en mission"
          value={kpi ? `${kpi.chauffeurs_mission} / ${kpi.chauffeurs_total}` : '-'}
          sub={kpi?.chauffeurs_total ? Math.round((100 * kpi.chauffeurs_mission) / kpi.chauffeurs_total) + '%' : ''}
        />
        <KpiCard
          title="♻️ Collecté aujourd'hui"
          value={kpi ? `${kpi.collecte_aujourdhui ?? 0} kg` : '-'}
          sub={kpi?.collecte_variation_pct != null ? `${kpi.collecte_variation_pct >= 0 ? '↑' : ''}${kpi.collecte_variation_pct}% vs hier` : ''}
        />
        <KpiCard
          title="📍 Points en attente"
          value={kpi?.points_en_attente ?? '-'}
        />
      </div>
      <h2 className="text-lg font-semibold mb-3">Activité du jour</h2>
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--primary-light)]">
              <th className="text-left p-3 font-semibold">Chauffeur</th>
              <th className="text-left p-3 font-semibold">Zone</th>
              <th className="text-left p-3 font-semibold">Statut</th>
              <th className="text-left p-3 font-semibold">Progression</th>
            </tr>
          </thead>
          <tbody>
            {plannings.map((p) => {
              const u = usersById[p.chauffeur_id]
              const total = p.points?.length ?? 0
              const done = p.points?.filter((pp) => pp.collecte_effectuee).length ?? 0
              const pct = total ? Math.round((100 * done) / total) : 0
              return (
                <tr key={p.id} className="border-t border-[var(--color-border)] hover:bg-gray-50">
                  <td className="p-3">{u ? u.nom : p.chauffeur_id}</td>
                  <td className="p-3">Z{u ? u.zone_affectee ?? '-' : '-'}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-sm ${
                        p.status === 'en_cours' ? 'bg-amber-100 text-amber-800' : p.status === 'termine' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3">{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ title, value, sub }) {
  return (
    <div
      className="rounded-xl border-l-4 border-[var(--primary)] bg-white p-4 shadow-sm hover:shadow-md transition"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className="text-sm text-[var(--color-text-muted)] mb-1">{title}</h3>
      <div className="text-xl font-bold text-[var(--color-text)]">{value}</div>
      {sub && <small className="text-[var(--color-text-muted)]">{sub}</small>}
    </div>
  )
}
