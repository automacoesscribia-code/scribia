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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAdmin = createClient(
      supabaseUrl,
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

    // --- Speaker record ---
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

    // --- Invitation record ---
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

    // --- Resolve redirect URL ---
    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || supabaseUrl
    const redirectTo = `${siteUrl}/auth/set-password?token=${invitation.token}`

    const roleName = roleLabels[role] || role
    const userMetadata = {
      full_name: role === 'speaker' ? (speaker_name || '') : '',
      role: role,
      invitation_token: invitation.token,
    }

    // --- Check if user already exists ---
    const { data: { users: matchedUsers } } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      filter: email,
    } as never)
    const existingUser = matchedUsers?.[0] ?? null

    let emailSent = false

    if (existingUser) {
      // --- Existing user: update metadata + add to event ---
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, ...userMetadata },
      })

      if (updateError) {
        return new Response(JSON.stringify({ error: `Erro ao atualizar usuario: ${updateError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Add to event directly
      if (event_id && (role === 'participant' || role === 'speaker')) {
        await supabaseAdmin
          .from('event_participants')
          .upsert({ event_id, user_id: existingUser.id }, { onConflict: 'event_id,user_id' })
      }

      // Link speaker record
      if (role === 'speaker' && speakerId) {
        await supabaseAdmin
          .from('speakers')
          .update({ user_id: existingUser.id })
          .eq('id', speakerId)
      }

      // Mark invitation as accepted (user already has account)
      await supabaseAdmin
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      // Notify existing user via magic link email (Supabase sends the email)
      const { error: magicErr } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      })

      if (magicErr) {
        console.warn(`Magic link email failed for ${email}:`, magicErr.message)
      } else {
        emailSent = true
      }

    } else {
      // --- New user: invite via Supabase (creates user + sends email) ---
      // Invitation stays 'pending' so handle_new_user trigger can find it
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: userMetadata,
        redirectTo,
      })

      if (inviteError) {
        return new Response(JSON.stringify({ error: `Erro ao convidar usuario: ${inviteError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      emailSent = true
      console.log(`Invite email sent to ${email} as ${roleName} via Supabase Auth`)
    }

    const isNewUser = !existingUser
    const emailNote = emailSent
      ? 'Email de convite enviado pelo Supabase.'
      : 'Usuario adicionado ao evento (ja possui conta).'

    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      speaker_id: speakerId,
      email_sent: emailSent,
      is_new_user: isNewUser,
      message: `${roleName} ${isNewUser ? 'convidado' : 'adicionado'}! ${emailNote}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-invitation error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
