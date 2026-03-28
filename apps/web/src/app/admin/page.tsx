import { createClient } from '@/lib/supabase-server'
import { StatCard } from '@/components/ui/stat-card'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()

  // Count organizers
  const { count: organizerCount } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'organizer')

  // Count participants
  const { count: participantCount } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'participant')

  // Count total events
  const { count: eventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  // Count active events
  const { count: activeEventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Count pending invitations
  const { count: pendingInvitations } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // Recent organizers
  const { data: recentOrganizers } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, created_at')
    .eq('role', 'organizer')
    .order('created_at', { ascending: false })
    .limit(5)

  const organizers = (recentOrganizers ?? []) as Array<{
    id: string; email: string; full_name: string; created_at: string
  }>

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-9">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Painel Administrativo</h1>
          <p className="text-[13px] text-text3 mt-0.5">Gerencie organizadores, eventos e convites</p>
        </div>
        <Link
          href="/admin/invitations?action=new&role=organizer"
          className="inline-flex items-center gap-1.5 bg-purple text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:bg-purple-light glow-purple"
        >
          <Plus className="w-3.5 h-3.5" />
          Convidar Organizador
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7 stagger-children">
        <StatCard
          label="Organizadores"
          value={organizerCount ?? 0}
          sub="contas ativas"
          accent="purple"
        />
        <StatCard
          label="Participantes"
          value={participantCount ?? 0}
          sub="registrados"
          accent="green"
        />
        <StatCard
          label="Eventos"
          value={eventCount ?? 0}
          sub={`${activeEventCount ?? 0} ativos`}
          badge={activeEventCount ? `${activeEventCount} ativos` : undefined}
          badgeVariant="green"
          accent="yellow"
        />
        <StatCard
          label="Convites Pendentes"
          value={pendingInvitations ?? 0}
          sub="aguardando aceite"
          accent="teal"
        />
      </div>

      {/* Recent Organizers */}
      <div className="bg-bg2 border border-border-subtle rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-[15px] font-bold text-text">Organizadores Recentes</h2>
          <Link href="/admin/organizers" className="text-[12px] text-purple-light hover:text-purple transition-colors">
            Ver todos
          </Link>
        </div>

        {organizers.length === 0 ? (
          <p className="text-[13px] text-text3 text-center py-8">
            Nenhum organizador cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {organizers.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between px-4 py-3 bg-bg3 rounded-lg"
              >
                <div>
                  <div className="text-[13px] font-medium text-text">{org.full_name || 'Sem nome'}</div>
                  <div className="text-[11px] text-text3">{org.email}</div>
                </div>
                <div className="text-[11px] text-text3">
                  {new Date(org.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
