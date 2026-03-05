import { motion } from 'framer-motion'

const STEPS = [
  { id: 'points', label: 'Points', short: 'Points' },
  { id: 'zones', label: 'Zones', short: 'Zones' },
  { id: 'camions', label: 'Camions', short: 'Camions' },
  { id: 'creneaux', label: 'Créneaux', short: 'Créneaux' },
  { id: 'contraintes', label: 'Contraintes', short: 'Contraintes' },
  { id: 'optimization', label: 'Optimisation', short: 'Optimisation' },
  { id: 'planning', label: 'Résultats', short: 'Résultats' },
]

export default function Stepper({ currentStep, steps = STEPS }) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-12">
      {steps.map((step, index) => {
        const isCompleted = index < safeIndex
        const isActive = index === safeIndex
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="flex items-center">
            <motion.div
              initial={false}
              animate={{
                scale: isActive ? 1.05 : 1,
                backgroundColor: isCompleted
                  ? '#FF5A5F'
                  : isActive
                    ? '#FF5A5F'
                    : '#EBEBEB',
                color: isCompleted || isActive ? 'white' : '#717171',
              }}
              transition={{ duration: 0.3 }}
              className="
                w-10 h-10 rounded-full flex items-center justify-center
                font-semibold text-sm
              "
            >
              {isCompleted ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </motion.div>

            {!isLast && (
              <div
                className={`w-12 sm:w-24 h-1 mx-1 rounded transition-colors duration-300 ${
                  index < safeIndex ? 'bg-[#FF5A5F]' : 'bg-[#EBEBEB]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
