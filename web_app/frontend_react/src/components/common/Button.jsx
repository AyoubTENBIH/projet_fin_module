import { motion } from 'framer-motion'

const variants = {
  primary:
    'bg-[#FF5A5F] hover:bg-[#E04850] text-white shadow-md hover:shadow-lg hover:scale-[1.02]',
  secondary:
    'bg-white border-2 border-[#EBEBEB] text-[#222222] hover:border-[#222222]',
  ghost: 'text-[#717171] hover:bg-gray-100',
  success: 'bg-[#00A699] hover:bg-[#008B82] text-white shadow-md hover:shadow-lg',
}

export default function Button({
  children,
  variant = 'primary',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  icon,
  ...props
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={`
        inline-flex items-center justify-center gap-2
        px-6 py-3 rounded-xl font-semibold
        transition-all duration-300 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </motion.button>
  )
}
