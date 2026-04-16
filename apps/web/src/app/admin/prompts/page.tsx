import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { PromptEditor } from '@/components/settings/prompt-editor'

export default async function AdminPromptsPage() {
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

  // Fetch all prompts
  const { data: prompts } = await supabase
    .from('system_prompts')
    .select('*')
    .order('created_at', { ascending: true })

  const promptList = (prompts ?? []) as Array<{
    id: string
    key: string
    name: string
    description: string | null
    prompt_text: string
    updated_at: string
  }>

  return (
    <div className="max-w-4xl">
      <div className="mb-6 md:mb-8">
        <h1 className="font-heading text-[20px] sm:text-[24px] font-extrabold text-text leading-tight">
          Configuracao de Prompts
        </h1>
        <p className="text-[13px] text-text3 mt-1">
          Edite os prompts usados pela IA para gerar resumos, e-books, playbooks e imagens.
          Use as variaveis entre {'{{chaves}}'} para inserir dados dinamicos.
        </p>
      </div>

      <PromptEditor prompts={promptList} />
    </div>
  )
}
