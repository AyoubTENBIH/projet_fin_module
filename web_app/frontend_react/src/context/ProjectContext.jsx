import { createContext, useContext, useState } from 'react'

export const STORAGE_KEY = 'villepropre_state'

let savedCache = null
export function getSaved() {
  if (savedCache) return savedCache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    savedCache = raw ? JSON.parse(raw) : {}
  } catch {
    savedCache = {}
  }
  return savedCache
}

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
  const [points, setPoints] = useState(() => (Array.isArray(getSaved().points) ? getSaved().points : []))
  const [camions, setCamions] = useState(() => (Array.isArray(getSaved().camions) ? getSaved().camions : []))
  const [creneaux, setCreneaux] = useState(() => (Array.isArray(getSaved().creneaux) ? getSaved().creneaux : []))
  const [planningResult, setPlanningResult] = useState(() => getSaved().planningResult ?? null)
  const [routesResult, setRoutesResult] = useState(() => getSaved().routesResult ?? null)
  const [contraintes, setContraintes] = useState(() => {
    const s = getSaved().contraintes
    return s && typeof s === 'object' ? { fenetres_zone: [], pauses_obligatoires: [], zones_interdites_nuit: [], ...s } : { fenetres_zone: [], pauses_obligatoires: [], zones_interdites_nuit: [] }
  })
  const [depot, setDepot] = useState(() => getSaved().depot ?? null)
  const [dechetteries, setDechetteries] = useState(() => (Array.isArray(getSaved().dechetteries) ? getSaved().dechetteries : []))

  const loadProject = (data) => {
    if (!data || typeof data !== 'object') return
    const defLat = 33.5731
    const defLng = -7.5898
    let pts = []
    if (Array.isArray(data.points) && data.points.length) {
      pts = data.points.map((p, i) => ({
        ...p,
        id: p.id ?? i + 1,
        lat: Number(p.lat) || defLat,
        lng: Number(p.lng) || defLng,
      }))
    }
    const depotObj = data.depot && typeof data.depot === 'object'
      ? { ...data.depot, lat: Number(data.depot.lat) || defLat, lng: Number(data.depot.lng) || defLng }
      : null
    if (depotObj) {
      const depotInPoints = pts.some((p) => p.id === depotObj.id)
      if (!depotInPoints && depotObj.lat != null && depotObj.lng != null) {
        const depotPoint = {
          id: depotObj.id ?? 0,
          nom: depotObj.nom ?? 'Dépôt',
          lat: depotObj.lat,
          lng: depotObj.lng,
          volume: 0,
          priorite: 'normale',
        }
        pts = [depotPoint, ...pts]
        setDepot(depotPoint)
      } else {
        const match = pts.find((p) => p.id === depotObj.id) ?? pts[0]
        setDepot(match || depotObj)
      }
    }
    setPoints(pts)
    if (Array.isArray(data.camions) && data.camions.length) setCamions(data.camions)
    if (Array.isArray(data.dechetteries) && data.dechetteries.length) {
      setDechetteries(
        data.dechetteries.map((x, i) => ({
          ...x,
          id: x.id ?? 100 + i,
          lat: Number(x.lat) || defLat,
          lng: Number(x.lng) || defLng,
        }))
      )
    }
  }

  const addDechetterie = (d) => {
    setDechetteries((prev) => [...prev, { ...d, id: d.id ?? (prev.length ? Math.max(...prev.map((x) => x.id)) + 1 : 11) }])
  }

  const removeDechetterie = (id) => {
    setDechetteries((prev) => prev.filter((x) => x.id !== id))
  }
  const [currentStep, setCurrentStep] = useState('home')

  const addPoint = (point) => {
    setPoints((prev) => {
      const id = point.id ?? (prev.length ? Math.max(...prev.map((p) => p.id)) + 1 : 1)
      return [...prev, { ...point, id }]
    })
  }

  const removePoint = (id) => {
    setPoints((prev) => prev.filter((p) => p.id !== id))
  }

  const addCamion = (camion) => {
    setCamions((prev) => [...prev, camion])
  }

  const removeCamion = (id) => {
    setCamions((prev) => prev.filter((c) => c.id !== id))
  }

  const updateCamion = (id, updates) => {
    setCamions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
  }

  const value = {
    points,
    setPoints,
    addPoint,
    removePoint,
    camions,
    setCamions,
    addCamion,
    removeCamion,
    updateCamion,
    creneaux,
    setCreneaux,
    contraintes,
    setContraintes,
    planningResult,
    setPlanningResult,
    routesResult,
    setRoutesResult,
    depot,
    setDepot,
    dechetteries,
    setDechetteries,
    loadProject,
    addDechetterie,
    removeDechetterie,
    currentStep,
    setCurrentStep,
  }

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error('useProject must be used within ProjectProvider')
  }
  return ctx
}
