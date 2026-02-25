import { motion } from 'framer-motion'
import { Truck, MapPin, Zap } from 'lucide-react'
import Button from '../components/common/Button'

export default function Home({ onStart, onImport }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="px-8 py-6 flex justify-between items-center border-b border-[#EBEBEB]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FF5A5F] flex items-center justify-center">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-[#222222]">VillePropre</span>
        </div>
        <button className="text-[#222222] hover:underline font-medium">
          Se connecter
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-bold text-[#222222] leading-tight">
              Optimisez vos tournées de collecte en quelques clics
            </h1>
            <p className="text-lg text-[#717171]">
              Planification intelligente • Coûts réduits • Respect des contraintes temporelles
            </p>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <Button
              variant="primary"
              onClick={onStart}
              className="w-full sm:w-auto px-10 py-4 text-lg"
              icon={<Truck className="w-5 h-5" />}
            >
              Créer un nouveau projet
            </Button>

            <div className="pt-6 space-y-2">
              <p className="text-sm text-[#717171]">ou charger un projet existant :</p>
              <Button
                variant="secondary"
                onClick={onImport}
                icon={<MapPin className="w-4 h-4" />}
              >
                Importer depuis fichier
              </Button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-8 pt-12 text-sm text-[#717171]"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#00A699]" />
              Niveau 1, 2 & 3
            </span>
            <span>Simulation temps réel</span>
            <span>Export PDF</span>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
