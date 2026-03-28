import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { AdminSidebar } from '@/components/layout/admin-sidebar'

export default async function AdminLayout({
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

  const roles = (profile as { roles: string[] } | null)?.roles ?? []
  if (!roles.includes('super_admin')) redirect('/forbidden')

  const userName = (profile as { full_name: string } | null)?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userName={userName} />
      <main className="ml-[220px] flex-1 p-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}
