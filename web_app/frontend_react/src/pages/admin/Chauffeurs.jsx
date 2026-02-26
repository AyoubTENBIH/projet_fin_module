import { useState, useEffect } from 'react'
import { ecoAgadirApi } from '../../utils/ecoAgadirApi'

export default function Chauffeurs() {
  const [users, setUsers] = useState([])
  const [camions, setCamions] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState({ open: false, id: null })
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', permis: '', password: '', camion_id: '', zone_affectee: '', status: 'actif' })

  function load() {
    Promise.all([ecoAgadirApi.users.list({ role: 'chauffeur' }), ecoAgadirApi.camions.list()]).then(
      ([u, c]) => {
        setUsers(u)
        setCamions(c || [])
      }
    )
  }

  useEffect(() => load(), [])

  const filtered = search
    ? users.filter((u) => (u.nom + ' ' + u.email).toLowerCase().includes(search.toLowerCase()))
    : users

  function openEdit(id) {
    if (id) {
      ecoAgadirApi.users.get(id).then((u) => {
        setForm({
          nom: u.nom || '',
          email: u.email || '',
          telephone: u.telephone || '',
          permis: u.permis || '',
          password: '',
          camion_id: u.camion_id || '',
          zone_affectee: u.zone_affectee ?? '',
          status: u.status || 'actif',
        })
        setModal({ open: true, id })
      })
    } else {
      setForm({ nom: '', email: '', telephone: '', permis: '', password: 'Chauffeur1!', camion_id: '', zone_affectee: '', status: 'actif' })
      setModal({ open: true, id: null })
    }
  }

  async function submit(e) {
    e.preventDefault()
    const data = { ...form, zone_affectee: form.zone_affectee ? parseInt(form.zone_affectee, 10) : null, camion_id: form.camion_id || null }
    if (form.password) data.password = form.password
    if (modal.id) await ecoAgadirApi.users.update(modal.id, data)
    else await ecoAgadirApi.users.create(data)
    setModal({ open: false, id: null })
    load()
  }

  async function remove(id) {
    if (!confirm('Supprimer ce chauffeur ?')) return
    await ecoAgadirApi.users.delete(id)
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">Chauffeurs</h1>
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={() => openEdit(null)}
          className="px-4 py-2 rounded-lg font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
        >
          + Ajouter Chauffeur
        </button>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Rechercher"
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg max-w-xs"
        />
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--primary-light)]">
              <th className="text-left p-3 font-semibold">Avatar</th>
              <th className="text-left p-3 font-semibold">Nom</th>
              <th className="text-left p-3 font-semibold">Statut</th>
              <th className="text-left p-3 font-semibold">Camion</th>
              <th className="text-left p-3 font-semibold">Zone</th>
              <th className="text-left p-3 font-semibold">Dernière activité</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[var(--color-border)] hover:bg-gray-50">
                <td className="p-3">{u.avatar || '?'}</td>
                <td className="p-3">{u.nom}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-sm ${
                      u.status === 'en_mission' ? 'bg-amber-100' : u.status === 'actif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="p-3">{u.camion_id || '-'}</td>
                <td className="p-3">Z{u.zone_affectee ?? '-'}</td>
                <td className="p-3">{u.derniere_connexion ? new Date(u.derniere_connexion).toLocaleString('fr-FR') : '-'}</td>
                <td className="p-3">
                  <button
                    onClick={() => openEdit(u.id)}
                    className="mr-2 px-2 py-1 rounded bg-[var(--primary)] text-white text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => remove(u.id)}
                    className="px-2 py-1 rounded bg-red-500 text-white text-sm"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal((m) => ({ ...m, open: false }))}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{modal.id ? 'Modifier Chauffeur' : 'Ajouter Chauffeur'}</h2>
            <form onSubmit={submit} className="space-y-3">
              <input type="text" placeholder="Nom" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
              <input type="text" placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Permis (C)" value={form.permis} onChange={(e) => setForm((f) => ({ ...f, permis: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              <input type="password" placeholder={modal.id ? 'Laisser vide pour garder' : 'Mot de passe'} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              <select value={form.camion_id} onChange={(e) => setForm((f) => ({ ...f, camion_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="">— Aucun —</option>
                {camions.filter((c) => c.etat === 'operationnel').map((c) => (
                  <option key={c.id} value={c.id}>{c.immatriculation}</option>
                ))}
              </select>
              <input type="number" placeholder="Zone" value={form.zone_affectee} onChange={(e) => setForm((f) => ({ ...f, zone_affectee: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 rounded-lg text-white bg-[var(--primary)]">Enregistrer</button>
                <button type="button" onClick={() => setModal({ open: false, id: null })} className="px-4 py-2 rounded-lg border">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
