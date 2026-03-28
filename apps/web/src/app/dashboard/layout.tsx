import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, roles')
    .eq('id', user.id)
    .single()

  const userName = (profile as { full_name: string } | null)?.full_name ?? user.email?.split('@')[0] ?? 'Organizador'
  const roles = (profile as { roles: string[] } | null)?.roles ?? []
  const roleLabel: Record<string, string> = { super_admin: 'Administrador', organizer: 'Organizador', participant: 'Participante' }
  const primaryRole = roles.includes('super_admin') ? 'super_admin' : roles.includes('organizer') ? 'organizer' : 'participant'
  const userRole = roleLabel[primaryRole] ?? 'Usuário'

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={userName} userRole={userRole} isSuperAdmin={roles.includes('super_admin')} />
      <main className="ml-[220px] flex-1 p-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}
