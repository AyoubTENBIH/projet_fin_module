import { motion } from 'framer-motion'

export default function Card({
  children,
  hover = false,
  className = '',
  onClick,
  padding = true,
}) {
  const Component = motion.div

  return (
    <Component
      onClick={onClick}
      whileHover={hover ? { scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' } : {}}
      transition={{ duration: 0.3 }}
      className={`
        bg-white rounded-xl border border-[#EBEBEB]
        shadow-[0_1px_3px_rgba(0,0,0,0.12)]
        ${padding ? 'p-6' : ''}
        ${hover ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </Component>
  )
}
