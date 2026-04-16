import { cn } from '@/lib/utils'

type AccentColor = 'purple' | 'green' | 'yellow' | 'teal' | 'red'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  badge?: string
  badgeVariant?: 'green' | 'yellow'
  accent?: AccentColor
  className?: string
}

const accentClass: Record<AccentColor, string> = {
  purple: 'card-accent-purple',
  green: 'card-accent-green',
  yellow: 'card-accent-yellow',
  teal: 'card-accent-teal',
  red: 'card-accent-red',
}

const badgeStyles = {
  green: 'bg-scribia-green/10 text-scribia-green',
  yellow: 'bg-scribia-yellow/10 text-scribia-yellow',
}

export function StatCard({
  label,
  value,
  sub,
  badge,
  badgeVariant = 'green',
  accent = 'purple',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'relative bg-bg2 border border-border-subtle rounded-xl p-4 sm:p-5 overflow-hidden transition-colors hover:border-border-purple animate-fade-up',
        accentClass[accent],
        className,
      )}
    >
      <div className="text-[11px] sm:text-[11.5px] text-text3 uppercase tracking-[0.8px] mb-2 sm:mb-2.5">
        {label}
      </div>
      <div className="font-heading text-[26px] sm:text-[32px] font-extrabold text-text leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-text3 mt-1.5">{sub}</div>
      )}
      {badge && (
        <div
          className={cn(
            'inline-flex items-center gap-1 text-[11px] mt-2 px-2 py-0.5 rounded-full',
            badgeStyles[badgeVariant],
          )}
        >
          {badge}
        </div>
      )}
    </div>
  )
}
