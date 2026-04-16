import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6 md:mb-9">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-text">Relatórios</h1>
          <p className="text-[13px] text-text3 mt-0.5">Relatórios e analytics dos seus eventos</p>
        </div>
      </div>

      <div className="mt-12 sm:mt-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-dim border border-border-purple flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-7 h-7 text-purple-light" />
        </div>
        <p className="text-text2 text-[14px]">Relatórios aparecerão aqui</p>
        <p className="text-text3 text-[13px] mt-1">
          Acesse os analytics de cada evento na aba &quot;Analytics&quot; dentro do detalhe do evento.
        </p>
      </div>
    </div>
  )
}
