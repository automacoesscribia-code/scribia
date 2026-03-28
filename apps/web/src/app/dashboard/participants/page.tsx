import { createClient } from '@/lib/supabase-server'
import { Users } from 'lucide-react'

export default async function ParticipantsPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('event_participants')
    .select('id, attended, registered_at, user_profiles(full_name, email), events(name)')
    .order('registered_at', { ascending: false })

  const participants = (data ?? []) as unknown as Array<{
    id: string; attended: boolean; registered_at: string;
    user_profiles: { full_name: string; email: string } | null;
    events: { name: string } | null
  }>

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-9">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Participantes</h1>
          <p className="text-[13px] text-text3 mt-0.5">Todos os participantes dos seus eventos</p>
        </div>
      </div>

      {participants.length > 0 ? (
        <div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">Nome</th>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">Email</th>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">Evento</th>
                <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] px-5 py-2.5 text-left border-b border-border-subtle">Presença</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-bg3">
                  <td className="px-5 py-3 text-[13px] text-text border-b border-border-subtle">
                    {p.user_profiles?.full_name ?? 'Sem nome'}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text3 border-b border-border-subtle">
                    {p.user_profiles?.email ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text2 border-b border-border-subtle">
                    {p.events?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-[13px] border-b border-border-subtle">
                    <span className={`inline-flex items-center gap-1 text-[11px] ${p.attended ? 'text-scribia-green' : 'text-text3'}`}>
                      {p.attended ? '● Presente' : '○ Ausente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-text3 text-[13px]">Nenhum participante registrado.</p>
        </div>
      )}
    </div>
  )
}
