import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { AiSettingsEditor } from '@/components/settings/ai-settings-editor'

export default async function AdminAiSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user is super_admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('roles')
    .eq('id', user.id)
    .single()

  const roles = (profile as { roles: string[] } | null)?.roles ?? []
  if (!roles.includes('super_admin')) redirect('/admin')

  // Fetch AI settings (singleton row)
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('*')
    .limit(1)
    .single()

  const aiSettings = (settings ?? {
    id: '',
    provider: 'gemini',
    api_key: '',
    model: 'gemini-2.5-flash',
    updated_at: new Date().toISOString(),
  }) as {
    id: string
    provider: string
    api_key: string
    model: string
    updated_at: string
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 md:mb-8">
        <h1 className="font-heading text-[20px] sm:text-[24px] font-extrabold text-text leading-tight">
          Configuracao de IA
        </h1>
        <p className="text-[13px] text-text3 mt-1">
          Configure o provedor de IA, chave de API e modelo utilizado para gerar resumos,
          e-books e playbooks automaticamente.
        </p>
      </div>

      <AiSettingsEditor settings={aiSettings} />
    </div>
  )
}
