import { useState, useEffect } from 'react'
import { ecoAgadirApi } from '../../utils/ecoAgadirApi'

export default function Statistiques() {
  const [journalieres, setJournalieres] = useState([])
  const [classement, setClassement] = useState([])
  const [jours, setJours] = useState(30)

  useEffect(() => {
    Promise.all([
      ecoAgadirApi.stats.journalieres(jours),
      ecoAgadirApi.stats.classementChauffeurs(jours),
    ]).then(([j, c]) => {
      setJournalieres(j || [])
      setClassement(c || [])
    })
  }, [jours])

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">Statistiques</h1>
      <div className="mb-4">
        <label className="mr-2">Période (jours):</label>
        <select value={jours} onChange={(e) => setJours(Number(e.target.value))} className="px-3 py-2 border rounded-lg">
          <option value={7}>7</option>
          <option value={30}>30</option>
          <option value={90}>90</option>
        </select>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <h2 className="font-semibold mb-3">Collecte quotidienne (kg)</h2>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {journalieres.slice(-14).reverse().map((r) => (
              <div key={r.date_stat} className="flex justify-between text-sm">
                <span>{r.date_stat}</span>
                <span className="font-medium">{r.total_collecte} kg</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <h2 className="font-semibold mb-3">Classement chauffeurs</h2>
          <div className="space-y-2">
            {classement.slice(0, 10).map((c, i) => (
              <div key={c.chauffeur_id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <span>
                  {i === 0 && '🥇 '}
                  {i === 1 && '🥈 '}
                  {i === 2 && '🥉 '}
                  {c.nom}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {c.tournees} tournées · {c.kg_collectes} kg · {c.efficacite_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
