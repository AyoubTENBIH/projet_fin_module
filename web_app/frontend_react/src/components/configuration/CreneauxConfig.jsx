import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Clock, Pencil, Trash2, Copy } from 'lucide-react'
import Button from '../common/Button'
import Card from '../common/Card'
import Stepper from '../common/Stepper'

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const JOURS_LABELS = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
}

const TEMPLATES = {
  semaine_classique: {
    nom: 'Semaine classique',
    creneaux: [
      { jour: 'lundi', debut: '06:00', fin: '08:00', congestion: 1 },
      { jour: 'lundi', debut: '08:00', fin: '10:00', congestion: 1.3 },
      { jour: 'lundi', debut: '14:00', fin: '16:00', congestion: 1.1 },
      { jour: 'mardi', debut: '06:00', fin: '08:00', congestion: 1 },
      { jour: 'mardi', debut: '08:00', fin: '10:00', congestion: 1.3 },
      { jour: 'mardi', debut: '14:00', fin: '16:00', congestion: 1.1 },
      { jour: 'mercredi', debut: '06:00', fin: '08:00', congestion: 1 },
      { jour: 'mercredi', debut: '14:00', fin: '16:00', congestion: 1.1 },
      { jour: 'jeudi', debut: '06:00', fin: '08:00', congestion: 1 },
      { jour: 'jeudi', debut: '14:00', fin: '16:00', congestion: 1.1 },
      { jour: 'vendredi', debut: '06:00', fin: '08:00', congestion: 1 },
      { jour: 'vendredi', debut: '14:00', fin: '16:00', congestion: 1.1 },
    ],
  },
  mediterranee: {
    nom: 'Ville méditerranéenne (sieste 14h-16h)',
    creneaux: [
      { jour: 'lundi', debut: '06:00', fin: '10:00', congestion: 1.2 },
      { jour: 'lundi', debut: '16:00', fin: '20:00', congestion: 1.3 },
      { jour: 'mardi', debut: '06:00', fin: '10:00', congestion: 1.2 },
      { jour: 'mardi', debut: '16:00', fin: '20:00', congestion: 1.3 },
      { jour: 'mercredi', debut: '06:00', fin: '10:00', congestion: 1.2 },
      { jour: 'mercredi', debut: '16:00', fin: '20:00', congestion: 1.3 },
      { jour: 'jeudi', debut: '06:00', fin: '10:00', congestion: 1.2 },
      { jour: 'jeudi', debut: '16:00', fin: '20:00', congestion: 1.3 },
      { jour: 'vendredi', debut: '06:00', fin: '10:00', congestion: 1.2 },
      { jour: 'vendredi', debut: '16:00', fin: '20:00', congestion: 1.4 },
    ],
  },
  ramadan: {
    nom: 'Ramadan (horaires spéciaux)',
    creneaux: [
      { jour: 'lundi', debut: '06:00', fin: '09:00', congestion: 1.1 },
      { jour: 'lundi', debut: '21:00', fin: '23:00', congestion: 1.4 },
      { jour: 'mardi', debut: '06:00', fin: '09:00', congestion: 1.1 },
      { jour: 'mardi', debut: '21:00', fin: '23:00', congestion: 1.4 },
      { jour: 'mercredi', debut: '06:00', fin: '09:00', congestion: 1.1 },
      { jour: 'mercredi', debut: '21:00', fin: '23:00', congestion: 1.4 },
      { jour: 'jeudi', debut: '06:00', fin: '09:00', congestion: 1.1 },
      { jour: 'jeudi', debut: '21:00', fin: '23:00', congestion: 1.4 },
      { jour: 'vendredi', debut: '06:00', fin: '09:00', congestion: 1.1 },
      { jour: 'vendredi', debut: '21:00', fin: '23:00', congestion: 1.5 },
    ],
  },
}

function CongestionBadge({ value }) {
  const v = parseFloat(value) || 1
  const color =
    v <= 1.1 ? 'bg-green-100 text-green-700' : v <= 1.4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  const label = v <= 1.1 ? 'Fluide' : v <= 1.4 ? 'Modéré' : 'Embouteillages'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label} ({v})
    </span>
  )
}

export default function CreneauxConfig({
  creneaux,
  onCreneauxChange,
  onNext,
  onBack,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState('personnalise')
  const [selectedDay, setSelectedDay] = useState('lundi')
  const [showModal, setShowModal] = useState(false)
  const [editingCreneau, setEditingCreneau] = useState(null)
  const [form, setForm] = useState({ jour: 'lundi', debut: '08:00', fin: '10:00', congestion: 1 })

  const creneauxByDay = JOURS.reduce((acc, j) => {
    acc[j] = (creneaux || []).filter((c) => c.jour === j)
    return acc
  }, {})

  const loadTemplate = (key) => {
    if (key === 'personnalise') return
    const t = TEMPLATES[key]
    if (t) {
      const withIds = t.creneaux.map((c, i) => ({ ...c, id: i + 1 }))
      onCreneauxChange(withIds)
      setSelectedTemplate(key)
    }
  }

  const handleAddCreneau = () => {
    setEditingCreneau(null)
    setForm({ jour: selectedDay, debut: '08:00', fin: '10:00', congestion: 1 })
    setShowModal(true)
  }

  const handleEditCreneau = (c) => {
    setEditingCreneau(c)
    setForm({ jour: c.jour, debut: c.debut, fin: c.fin, congestion: c.congestion ?? 1 })
    setShowModal(true)
  }

  const handleSaveCreneau = (e) => {
    e.preventDefault()
    const list = creneaux || []
    const newC = {
      jour: form.jour,
      debut: form.debut,
      fin: form.fin,
      congestion: parseFloat(form.congestion) || 1,
    }
    if (editingCreneau) {
      const idx = list.findIndex((c) => c.id === editingCreneau.id)
      if (idx >= 0) {
        const updated = [...list]
        updated[idx] = { ...newC, id: editingCreneau.id }
        onCreneauxChange(updated)
      }
    } else {
      const id = list.length ? Math.max(...list.map((x) => x.id || 0)) + 1 : 1
      onCreneauxChange([...list, { ...newC, id }])
    }
    setShowModal(false)
  }

  const handleDeleteCreneau = (c) => {
    const list = creneaux || []
    const match = (x) => (c.id != null && x.id === c.id) || (x.jour === c.jour && x.debut === c.debut && x.fin === c.fin)
    onCreneauxChange(list.filter((x) => !match(x)))
  }

  const handleDuplicateWeek = () => {
    const lundiCreneaux = (creneaux || []).filter((c) => c.jour === 'lundi')
    if (lundiCreneaux.length === 0) return
    const duplicated = []
    let id = (creneaux || []).length
    JOURS.forEach((jour) => {
      lundiCreneaux.forEach((c) => {
        id += 1
        duplicated.push({ ...c, jour, id })
      })
    })
    onCreneauxChange([...duplicated])
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
              Quand vos camions peuvent-ils travailler ?
            </h2>
            <p className="text-[#717171]">Définissez les créneaux horaires disponibles par jour</p>
          </div>

          {/* Template selector */}
          <Card>
            <label className="block text-sm font-medium text-[#222222] mb-3">
              Charger un template
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => loadTemplate(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTemplate === key
                      ? 'bg-[#FF5A5F] text-white'
                      : 'bg-gray-100 text-[#717171] hover:bg-gray-200'
                  }`}
                >
                  {t.nom}
                </button>
              ))}
              <button
                onClick={() => setSelectedTemplate('personnalise')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTemplate === 'personnalise'
                    ? 'bg-[#FF5A5F] text-white'
                    : 'bg-gray-100 text-[#717171] hover:bg-gray-200'
                }`}
              >
                Personnalisé
              </button>
            </div>
          </Card>

          {/* Day selector */}
          <div className="flex gap-2 flex-wrap">
            {JOURS.map((j) => (
              <button
                key={j}
                onClick={() => setSelectedDay(j)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay === j
                    ? 'bg-[#FF5A5F] text-white'
                    : 'bg-white border border-[#EBEBEB] text-[#717171] hover:border-[#222222]'
                }`}
              >
                {JOURS_LABELS[j]}
              </button>
            ))}
          </div>

          {/* Créneaux du jour */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[#222222]">
                {JOURS_LABELS[selectedDay]}
              </h3>
              <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={handleAddCreneau}>
                Ajouter un créneau
              </Button>
            </div>

            <div className="space-y-2">
              {(creneauxByDay[selectedDay] || []).length === 0 ? (
                <p className="text-[#717171] py-4 text-center">
                  Aucun créneau. Cliquez sur &quot;Ajouter un créneau&quot; ou chargez un template.
                </p>
              ) : (
                (creneauxByDay[selectedDay] || []).map((c) => (
                  <div
                    key={c.id || `${c.jour}-${c.debut}-${c.fin}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Clock className="w-5 h-5 text-[#717171]" />
                      <span className="font-semibold">{c.debut} – {c.fin}</span>
                      <CongestionBadge value={c.congestion} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditCreneau(c)}
                        className="p-2 rounded-lg hover:bg-gray-200 text-[#717171]"
                        aria-label="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCreneau(c)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="ghost"
              className="mt-4"
              icon={<Copy className="w-4 h-4" />}
              onClick={handleDuplicateWeek}
              disabled={(creneauxByDay['lundi'] || []).length === 0}
            >
              Dupliquer lundi sur toute la semaine
            </Button>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between pt-8">
            <Button variant="ghost" onClick={onBack}>
              ← Retour
            </Button>
            <Button
              variant="primary"
              onClick={onNext}
              disabled={!creneaux || creneaux.length === 0}
            >
              Suivant : Contraintes →
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Modal créneau */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowModal(false)}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
          >
            <h3 className="text-xl font-bold mb-6">
              {editingCreneau ? 'Modifier le créneau' : 'Ajouter un créneau'}
            </h3>
            <form onSubmit={handleSaveCreneau} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">Jour</label>
                <select
                  value={form.jour}
                  onChange={(e) => setForm({ ...form, jour: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB] focus:ring-2 focus:ring-[#FF5A5F]/50"
                >
                  {JOURS.map((j) => (
                    <option key={j} value={j}>{JOURS_LABELS[j]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">Début</label>
                  <input
                    type="time"
                    value={form.debut}
                    onChange={(e) => setForm({ ...form, debut: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#222222] mb-1">Fin</label>
                  <input
                    type="time"
                    value={form.fin}
                    onChange={(e) => setForm({ ...form, fin: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#EBEBEB]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#222222] mb-1">
                  Congestion (1 = fluide, 2 = embouteillages)
                </label>
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.1"
                  value={form.congestion}
                  onChange={(e) => setForm({ ...form, congestion: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <p className="text-sm text-[#717171] mt-1">
                  Trafic : {form.congestion <= 1.1 ? 'Fluide' : form.congestion <= 1.4 ? 'Modéré' : 'Embouteillages'} ({form.congestion})
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" variant="primary" className="flex-1">
                  {editingCreneau ? 'Enregistrer' : 'Ajouter'}
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
