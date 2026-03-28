'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Mic, Calendar, LogOut, Download, CheckCircle } from 'lucide-react'

interface SpeakerLecture {
  title: string
  eventName: string
  scheduledAt: string | null
  status: string
}

interface SpeakerWelcomeProps {
  userName: string
  lectures: SpeakerLecture[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'A definir'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusInfo(status: string): { label: string; color: string } {
  switch (status) {
    case 'completed':
    case 'processing':
      return { label: 'Gravada', color: 'text-scribia-green bg-scribia-green/10 border-scribia-green/20' }
    case 'recording':
      return { label: 'Em gravação', color: 'text-scribia-yellow bg-scribia-yellow/10 border-scribia-yellow/20' }
    default:
      return { label: 'Agendada', color: 'text-scribia-teal bg-scribia-teal/10 border-scribia-teal/20' }
  }
}

export function SpeakerWelcome({ userName, lectures }: SpeakerWelcomeProps) {
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6 animate-fade-up">
        {/* Logo */}
        <div className="text-center">
          <div className="font-heading font-extrabold text-3xl text-purple-light tracking-tight">
            SCRIBIA
          </div>
          <p className="text-text3 text-[12px] mt-1">Plataforma de Captação de Palestras</p>
        </div>

        {/* Welcome card */}
        <div className="bg-bg2 border border-border-subtle rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="font-heading text-2xl font-bold text-text">
              Olá, {userName}!
            </h1>
            <p className="text-[14px] text-text2 mt-2">
              Sua conta de palestrante está ativa.
            </p>
          </div>

          {/* Info card */}
          <div className="bg-purple-dim border border-border-purple rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <Mic className="w-5 h-5 text-purple-light mt-0.5 shrink-0" />
              <div>
                <div className="text-[14px] font-medium text-text">
                  Use o app ScribIA Capture para gravar suas palestras
                </div>
                <p className="text-[13px] text-text3 mt-1">
                  Baixe o aplicativo desktop, faça login com seu email e senha, e grave suas palestras com qualidade profissional.
                </p>
              </div>
            </div>
          </div>

          {/* Lectures list */}
          {lectures.length > 0 ? (
            <div>
              <h2 className="font-heading text-[14px] font-bold text-text mb-3">
                Suas palestras
              </h2>
              <div className="space-y-2">
                {lectures.map((lecture, i) => {
                  const statusInfo = getStatusInfo(lecture.status)
                  return (
                    <div
                      key={i}
                      className="bg-bg3 border border-border-subtle rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text truncate">
                          {lecture.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-text3">{lecture.eventName}</span>
                          <span className="text-[11px] text-text3">·</span>
                          <div className="flex items-center gap-1 text-[11px] text-text3">
                            <Calendar className="w-3 h-3" />
                            {formatDate(lecture.scheduledAt)}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 text-text3 mx-auto mb-2" />
              <p className="text-[13px] text-text3">
                Nenhuma palestra atribuída ainda.
              </p>
              <p className="text-[12px] text-text3 mt-1">
                O organizador do evento entrará em contato.
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <a
            href="#"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-purple text-white px-6 py-3 rounded-xl text-[14px] font-medium hover:bg-purple-light glow-purple transition-all"
          >
            <Download className="w-4 h-4" />
            Baixar ScribIA Capture
          </a>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 bg-bg2 border border-border-subtle text-text2 px-5 py-3 rounded-xl text-[14px] hover:bg-bg3 hover:text-text transition-all cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </div>
    </div>
  )
}
