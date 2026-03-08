import { useState } from 'react'
import { Truck, Plus, Pencil, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../common/Button'
import Card from '../common/Card'
import Stepper from '../common/Stepper'

export default function CamionsConfig({
  camions,
  zones = [],
  onAddCamion,
  onUpdateCamion,
  onRemoveCamion,
  onNext,
  onBack,
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ id: '', nom: '', capacite: 5000, cout_fixe: 200, zones_assignees: [] })
  const [bulkCount, setBulkCount] = useState(5)
  const BULK_OPTIONS = [2, 3, 5, 10, 15, 20]

  const nextCamionId = () =>
    camions.length ? Math.max(...camions.map((c) => c.id)) + 1 : 1

  const handleAddBulk = () => {
    const count = Math.min(Math.max(1, bulkCount), 50)
    let id = nextCamionId()
    for (let i = 0; i < count; i++) {
      onAddCamion({
        id: id + i,
        nom: `Camion ${id + i}`,
        capacite: 5000,
        cout_fixe: 200,
        zones_assignees: [],
      })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const zonesAssignees = form.zones_assignees || []
    if (editingId) {
      onUpdateCamion(editingId, {
        nom: form.nom || undefined,
        capacite: form.capacite,
        cout_fixe: form.cout_fixe,
        zones_assignees: zonesAssignees,
      })
      setEditingId(null)
    } else {
      const id = form.id ? parseInt(form.id, 10) : nextCamionId()
      onAddCamion({
        id,
        nom: form.nom || `Camion ${id}`,
        capacite: form.capacite,
        cout_fixe: form.cout_fixe,
        zones_assignees: zonesAssignees,
      })
    }
    setForm({ id: '', nom: '', capacite: 5000, cout_fixe: 200, zones_assignees: [] })
    setShowModal(false)
  }

  const openEdit = (c) => {
    setEditingId(c.id)
    setForm({
      id: String(c.id),
      nom: c.nom || '',
      capacite: c.capacite,
      cout_fixe: c.cout_fixe,
      zones_assignees: Array.isArray(c.zones_assignees) ? c.zones_assignees : (Array.isArray(c.zones_accessibles) ? c.zones_accessibles : []),
    })
    setShowModal(true)
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
              Vos camions disponibles
            </h2>
            <p className="text-[#717171]">Définissez la capacité et le coût de chaque véhicule</p>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {camions.map((c, i) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group"
                >
                  <Card hover className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#FF5A5F]/10 flex items-center justify-center">
                        <Truck className="w-6 h-6 text-[#FF5A5F]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#222222]">{c.nom || `Camion ${c.id}`}</p>
                        <p className="text-sm text-[#717171]">
                          Capacité : {c.capacite} kg • Coût journalier : {c.cout_fixe}€
                          {(c.zones_assignees ?? c.zones_accessibles ?? []).length > 0 && (
                            <> • Zones : {(c.zones_assignees ?? c.zones_accessibles).join(', ')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-[#717171] hover:text-[#222222]"
                        aria-label="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onRemoveCamion(c.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <Card className="bg-gray-50 border-dashed border-2 border-[#EBEBEB]">
            <p className="text-sm font-medium text-[#222222] mb-2">Ajouter plusieurs camions en une fois</p>
            <p className="text-xs text-[#717171] mb-3">
              Sélectionnez le nombre de camions à créer ; les noms seront générés automatiquement (Camion 1, Camion 2, …).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-sm text-[#717171]">Nombre :</span>
                <select
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg border border-[#EBEBEB] bg-white min-w-[80px]"
                >
                  {BULK_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} camion{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="secondary" onClick={handleAddBulk}>
                Ajouter {bulkCount} camion{bulkCount > 1 ? 's' : ''}
              </Button>
            </div>
          </Card>

          <Button
            variant="secondary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingId(null)
              setForm({ id: '', nom: '', capacite: 5000, cout_fixe: 200, zones_assignees: [] })
              setShowModal(true)
            }}
          >
            Ajouter un camion
          </Button>

          <div className="flex justify-between pt-8">
            <Button variant="ghost" onClick={onBack}>
              ← Retour
            </Button>
            <Button
              variant="primary"
              onClick={onNext}
              disabled={camions.length === 0}
            >
              Suivant : Créneaux →
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Modal Ajout/Modification Camion */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
          >
            <h3 className="text-xl font-bold mb-6">
              {editingId ? 'Modifier le camion' : 'Ajouter un camion'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">ID Camion</label>
                  <input
                    type="number"
                    min="1"
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50 focus:border-[#FF5A5F]"
                    placeholder="Auto"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Nom (affichage)</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50"
                  placeholder={editingId ? (camions.find((c) => c.id === editingId)?.nom || `Camion ${editingId}`) : 'Camion 1'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Capacité (kg)</label>
                <input
                  type="number"
                  min="0"
                  value={form.capacite}
                  onChange={(e) => setForm({ ...form, capacite: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Coût journalier (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cout_fixe}
                  onChange={(e) => setForm({ ...form, cout_fixe: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">
                  Zones assignées (vide = toutes)
                </label>
                <select
                  multiple
                  value={form.zones_assignees.map(String)}
                  onChange={(e) => {
                    const v = Array.from(e.target.selectedOptions, (o) => Number(o.value))
                    setForm({ ...form, zones_assignees: v })
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50 min-h-[80px]"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nom} (Zone {z.id})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#717171] mt-1">Ctrl/Cmd pour sélectionner plusieurs zones.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" variant="primary" className="flex-1">
                  {editingId ? 'Enregistrer' : 'Ajouter'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
