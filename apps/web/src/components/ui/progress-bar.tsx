import { cn } from '@/lib/utils'

type BarColor = 'purple' | 'green' | 'yellow' | 'teal' | 'red'

const colorClass: Record<BarColor, string> = {
  purple: 'bg-purple',
  green: 'bg-scribia-green',
  yellow: 'bg-scribia-yellow',
  teal: 'bg-scribia-teal',
  red: 'bg-scribia-red',
}

interface ProgressBarProps {
  label: string
  value: number
  max: number
  color?: BarColor
  className?: string
}

export function ProgressBar({
  label,
  value,
  max,
  color = 'purple',
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div className={cn('mb-4 last:mb-0', className)}>
      <div className="flex justify-between mb-1.5">
        <span className="text-[12.5px] text-text2">{label}</span>
        <span className="text-xs text-text3">
          {value}/{max}
        </span>
      </div>
      <div className="h-1 bg-bg4 rounded-sm overflow-hidden">
        <div
          className={cn('h-full rounded-sm transition-all duration-500', colorClass[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
