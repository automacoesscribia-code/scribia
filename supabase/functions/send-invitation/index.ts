import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const roleLabels: Record<string, string> = {
  organizer: 'Organizador',
  participant: 'Participante',
  speaker: 'Palestrante',
}

async function sendCredentialsEmail(email: string, password: string, role: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || 'noreply@scribia.app'

  if (!resendKey) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return { sent: false, error: 'RESEND_API_KEY not configured' }
  }

  const roleName = roleLabels[role] || role

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: `Scribia <${fromEmail}>`,
      to: [email],
      subject: `Seu acesso ao Scribia — ${roleName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #7C3AED; font-size: 28px; margin-bottom: 8px;">SCRIBIA</h1>
          <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Plataforma de eventos e conteudo</p>

          <div style="background: #F8F7FF; border: 1px solid #E9E5FF; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #333; font-size: 16px; margin: 0 0 16px 0;">Suas credenciais de acesso</h2>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #555;">
              <strong>Email:</strong> ${email}
            </p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #555;">
              <strong>Senha:</strong> <code style="background: #EDE9FE; padding: 2px 8px; border-radius: 4px; font-size: 15px;">${password}</code>
            </p>
            <p style="margin: 0; font-size: 14px; color: #555;">
              <strong>Perfil:</strong> ${roleName}
            </p>
          </div>

          <p style="color: #888; font-size: 12px;">
            Voce pode alterar sua senha apos o primeiro login nas configuracoes da sua conta.
          </p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return { sent: false, error: err }
  }

  return { sent: true }
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

    const defaultPassword = 'Scribia@2026'
    const userMetadata = {
      full_name: role === 'speaker' ? (speaker_name || '') : '',
      role: role,
      invitation_token: invitation.token,
    }

    // Check if user already exists in auth
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = users?.find((u: { email?: string }) => u.email === email)

    let isNewUser = false

    if (existingUser) {
      // Reset password to default
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { ...existingUser.user_metadata, ...userMetadata },
      })

      if (updateError) {
        return new Response(JSON.stringify({ error: `Erro ao atualizar usuario: ${updateError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // For existing user + participant with event_id, add to event directly
      if (event_id && (role === 'participant' || role === 'speaker')) {
        await supabaseAdmin
          .from('event_participants')
          .upsert({ event_id, user_id: existingUser.id }, { onConflict: 'event_id,user_id' })
      }
    } else {
      // Create new user with default password
      // NOTE: keep invitation as 'pending' so the DB trigger handle_new_user
      // can find it and auto-assign role + event_participants
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      })

      if (createError) {
        return new Response(JSON.stringify({ error: `Erro ao criar usuario: ${createError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      isNewUser = true
    }

    // Mark invitation as accepted (for new users, trigger already did this but it's idempotent)
    await supabaseAdmin
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)

    // Send email with credentials
    const emailResult = await sendCredentialsEmail(email, defaultPassword, role)

    const emailNote = emailResult.sent
      ? 'Email enviado com as credenciais.'
      : 'Email nao enviado (verifique RESEND_API_KEY). Compartilhe as credenciais manualmente.'

    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      speaker_id: speakerId,
      default_password: defaultPassword,
      email_sent: emailResult.sent,
      message: `Usuario ${isNewUser ? 'criado' : 'atualizado'}! ${emailNote}\nCredenciais: ${email} / ${defaultPassword}`,
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
