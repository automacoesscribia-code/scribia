import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="text-center animate-fade-up">
        <div className="w-20 h-20 rounded-2xl bg-scribia-red/10 border border-scribia-red/25 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-scribia-red" />
        </div>
        <h1 className="font-heading text-6xl font-extrabold text-scribia-red">403</h1>
        <h2 className="font-heading text-xl font-bold text-text mt-3">
          Acesso Não Autorizado
        </h2>
        <p className="text-[13px] text-text3 mt-2">
          Você não tem permissão para acessar esta página.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mt-6 bg-purple text-white px-6 py-2.5 rounded-lg text-[13px] font-medium hover:bg-purple-light glow-purple transition-all"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
