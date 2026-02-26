import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ecoAgadirApi } from '../../utils/ecoAgadirApi'

export default function Planning() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [plannings, setPlannings] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    Promise.all([
      ecoAgadirApi.planning.list({ date_from: date, date_to: date }),
      ecoAgadirApi.users.list({ role: 'chauffeur' }),
    ]).then(([pl, us]) => {
      setPlannings(pl)
      setUsers(us)
    })
  }, [date])

  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]))

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">Planning</h1>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg"
        />
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--primary-light)]">
              <th className="text-left p-3 font-semibold">Date</th>
              <th className="text-left p-3 font-semibold">Shift</th>
              <th className="text-left p-3 font-semibold">Chauffeur</th>
              <th className="text-left p-3 font-semibold">Zone</th>
              <th className="text-left p-3 font-semibold">Points</th>
              <th className="text-left p-3 font-semibold">Statut</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plannings.map((p) => {
              const u = usersById[p.chauffeur_id]
              const pts = p.points?.length ?? 0
              return (
                <tr key={p.id} className="border-t border-[var(--color-border)] hover:bg-gray-50">
                  <td className="p-3">{(p.date_planning || '').slice(0, 10)}</td>
                  <td className="p-3">{p.shift === 'matin' ? 'Matin' : 'Après-Midi'}</td>
                  <td className="p-3">{u ? u.nom : p.chauffeur_id}</td>
                  <td className="p-3">Z{u ? u.zone_affectee ?? '-' : '-'}</td>
                  <td className="p-3">{pts} pts</td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-sm ${
                        p.status === 'termine' ? 'bg-green-100' : p.status === 'en_cours' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link to={`/admin/suivi?planning=${p.id}`} className="mr-2 px-2 py-1 rounded bg-[var(--primary)] text-white text-sm">📡</Link>
                    <Link to={`/admin/carte?planning=${p.id}`} className="px-2 py-1 rounded bg-gray-200 text-sm">🗺️</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
