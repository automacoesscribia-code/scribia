import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const callerRoles: string[] = callerProfile?.roles ?? []

    const { email, role, event_id, speaker_name } = await req.json()

    if (!['organizer', 'participant', 'speaker'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Role invalida. Use: organizer, participant ou speaker' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (role === 'organizer' && !callerRoles.includes('super_admin')) {
      return new Response(JSON.stringify({ error: 'Apenas super_admin pode convidar organizadores' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (role === 'participant') {
      if (!callerRoles.includes('super_admin') && !callerRoles.includes('organizer')) {
        return new Response(JSON.stringify({ error: 'Apenas organizadores podem convidar participantes' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (role === 'speaker') {
      if (!callerRoles.includes('super_admin') && !callerRoles.includes('organizer')) {
        return new Response(JSON.stringify({ error: 'Apenas organizadores podem convidar palestrantes' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!event_id) {
        return new Response(JSON.stringify({ error: 'event_id e obrigatorio para convites de palestrantes' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if ((role === 'participant' || role === 'speaker') && event_id) {
      if (callerRoles.includes('organizer') && !callerRoles.includes('super_admin')) {
        const { data: eventOwner } = await supabaseAdmin
          .from('events')
          .select('id')
          .eq('id', event_id)
          .eq('organizer_id', user.id)
          .single()

        if (!eventOwner) {
          return new Response(JSON.stringify({ error: 'Organizador so pode convidar para seus proprios eventos' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    let speakerId: string | null = null

    if (role === 'speaker') {
      const speakerDisplayName = speaker_name || email.split('@')[0].replace(/[._]/g, ' ')

      const { data: existingSpeaker } = await supabaseAdmin
        .from('speakers')
        .select('id')
        .eq('email', email)
        .limit(1)
        .single()

      if (existingSpeaker) {
        speakerId = existingSpeaker.id
      } else {
        const { data: newSpeaker, error: speakerError } = await supabaseAdmin
          .from('speakers')
          .insert({ name: speakerDisplayName, email })
          .select('id')
          .single()

        if (speakerError) {
          return new Response(JSON.stringify({ error: `Erro ao criar palestrante: ${speakerError.message}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        speakerId = newSpeaker.id
      }
    }

    // Delete any previous pending invitations for this email+role to avoid duplicates
    await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('email', email)
      .eq('role', role)
      .eq('status', 'pending')

    const invitationRecord: Record<string, unknown> = {
      email,
      role,
      invited_by: user.id,
      event_id: event_id || null,
    }
    if (speakerId) {
      invitationRecord.speaker_id = speakerId
    }

    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .insert(invitationRecord)
      .select('id, token')
      .single()

    if (invError) {
      return new Response(JSON.stringify({ error: invError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL')
    if (!siteUrl) {
      console.warn('SITE_URL not set — using localhost. Set SITE_URL in Edge Function secrets for production.')
    }
    const redirectBase = siteUrl || 'http://localhost:3000'
    const redirectTo = `${redirectBase}/auth/set-password?token=${invitation.token}`

    // Send invite (creates user + sends email)
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          full_name: role === 'speaker' ? (speaker_name || '') : '',
          role: role,
          invitation_token: invitation.token,
        },
      },
    )

    if (inviteError) {
      // User already exists — reset password to default so admin can share credentials
      if (
        inviteError.message?.includes('already been registered') ||
        inviteError.message?.includes('already exists') ||
        inviteError.message?.includes('already been invited')
      ) {
        const defaultPassword = 'Scribia@2026'

        // Find existing user and reset their password
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = users?.find((u: { email?: string }) => u.email === email)

        if (existingUser) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password: defaultPassword,
            user_metadata: {
              ...existingUser.user_metadata,
              role: role,
              invitation_token: invitation.token,
            },
          })

          return new Response(JSON.stringify({
            success: true,
            invitation_id: invitation.id,
            speaker_id: speakerId,
            default_password: defaultPassword,
            message: `Usuario ja existe. Senha redefinida para a padrao. Informe as credenciais: ${email} / ${defaultPassword}`,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // User not found in list but invite failed — create fresh
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            full_name: role === 'speaker' ? (speaker_name || '') : '',
            role: role,
            invitation_token: invitation.token,
          },
        })

        if (createError) {
          return new Response(JSON.stringify({ error: `Erro ao criar usuario: ${createError.message}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({
          success: true,
          invitation_id: invitation.id,
          speaker_id: speakerId,
          default_password: defaultPassword,
          message: `Usuario criado com senha padrao. Informe as credenciais: ${email} / ${defaultPassword}`,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ error: `Erro ao enviar convite: ${inviteError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      speaker_id: speakerId,
      message: `Email de convite enviado para ${email}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
