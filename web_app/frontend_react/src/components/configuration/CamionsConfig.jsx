import { useState } from 'react'
import { Truck, Plus, Pencil, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../common/Button'
import Card from '../common/Card'
import Stepper from '../common/Stepper'

export default function CamionsConfig({
  camions,
  onAddCamion,
  onUpdateCamion,
  onRemoveCamion,
  onNext,
  onBack,
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ id: '', capacite: 5000, cout_fixe: 200, zones_accessibles: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    const zones = form.zones_accessibles
      ? form.zones_accessibles.split(',').map((z) => parseInt(z.trim(), 10)).filter(Boolean)
      : []
    if (editingId) {
      onUpdateCamion(editingId, { capacite: form.capacite, cout_fixe: form.cout_fixe, zones_accessibles: zones })
      setEditingId(null)
    } else {
      const id = form.id ? parseInt(form.id, 10) : (camions.length ? Math.max(...camions.map((c) => c.id)) + 1 : 1)
      onAddCamion({ id, capacite: form.capacite, cout_fixe: form.cout_fixe, zones_accessibles: zones })
    }
    setForm({ id: '', capacite: 5000, cout_fixe: 200, zones_accessibles: '' })
    setShowModal(false)
  }

  const openEdit = (c) => {
    setEditingId(c.id)
    setForm({
      id: String(c.id),
      capacite: c.capacite,
      cout_fixe: c.cout_fixe,
      zones_accessibles: Array.isArray(c.zones_accessibles) ? c.zones_accessibles.join(', ') : '',
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
                        <p className="font-semibold text-[#222222]">Camion {c.id}</p>
                        <p className="text-sm text-[#717171]">
                          Capacité : {c.capacite} kg • Coût journalier : {c.cout_fixe}€
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

          <Button
            variant="secondary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingId(null)
              setForm({ id: '', capacite: 5000, cout_fixe: 200, zones_accessibles: '' })
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
                    placeholder="1"
                  />
                </div>
              )}
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
                  Zones accessibles (IDs séparés par virgule, vide = toutes)
                </label>
                <input
                  type="text"
                  value={form.zones_accessibles}
                  onChange={(e) => setForm({ ...form, zones_accessibles: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50"
                  placeholder="1, 2, 3"
                />
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
