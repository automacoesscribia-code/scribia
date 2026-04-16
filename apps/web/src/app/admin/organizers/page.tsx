import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { UserList } from '@/components/admin/user-list'

export default async function OrganizersPage() {
  const supabase = await createClient()

  const { data: organizers } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, roles, created_at')
    .contains('roles', ['organizer'])
    .order('created_at', { ascending: false })

  const orgList = (organizers ?? []) as Array<{
    id: string; email: string; full_name: string; roles: string[]; created_at: string
  }>

  // Get event counts per organizer
  const orgIds = orgList.map((o) => o.id)
  let extraInfo: Record<string, string> = {}

  if (orgIds.length > 0) {
    const { data: events } = await supabase
      .from('events')
      .select('organizer_id')
      .in('organizer_id', orgIds)

    const evts = (events ?? []) as Array<{ organizer_id: string }>
    const counts = evts.reduce((acc, e) => {
      acc[e.organizer_id] = (acc[e.organizer_id] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    for (const org of orgList) {
      const count = counts[org.id] ?? 0
      extraInfo[org.id] = `${count} evento${count !== 1 ? 's' : ''}`
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 md:mb-9">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-text">Organizadores</h1>
          <p className="text-[13px] text-text3 mt-0.5">{orgList.length} organizadores cadastrados</p>
        </div>
        <Link
          href="/admin/invitations?action=new&role=organizer"
          className="inline-flex items-center justify-center gap-1.5 bg-purple text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:bg-purple-light glow-purple self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Convidar Organizador</span>
          <span className="sm:hidden">Convidar</span>
        </Link>
      </div>

      {orgList.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <p className="text-text3 text-[13px]">Nenhum organizador ainda.</p>
          <p className="text-text3 text-[13px] mt-1">
            <Link href="/admin/invitations?action=new&role=organizer" className="text-purple-light hover:text-purple transition-colors">
              Convide o primeiro organizador
            </Link>
          </p>
        </div>
      ) : (
        <UserList users={orgList} extraInfo={extraInfo} />
      )}
    </div>
  )
}
