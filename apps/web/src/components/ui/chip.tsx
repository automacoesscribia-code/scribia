import { cn } from '@/lib/utils'

type ChipVariant = 'green' | 'yellow' | 'purple' | 'red' | 'teal' | 'default'

const variantStyles: Record<ChipVariant, string> = {
  green: 'bg-scribia-green/10 text-scribia-green',
  yellow: 'bg-scribia-yellow/12 text-scribia-yellow',
  purple: 'bg-purple-dim text-purple-light',
  red: 'bg-scribia-red/10 text-scribia-red',
  teal: 'bg-scribia-teal/10 text-scribia-teal',
  default: 'bg-bg3 text-text2',
}

interface ChipProps {
  variant?: ChipVariant
  children: React.ReactNode
  className?: string
}

export function Chip({ variant = 'default', children, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium',
        variantStyles[variant],
        className,
      )}
    >
      <span className="w-[5px] h-[5px] rounded-full bg-current" />
      {children}
    </span>
  )
}
