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
    // Admin client (service_role) — used for all operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Extract user from JWT (gateway already verified it via verify_jwt: true)
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify caller has permission to invite
    const { data: callerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const callerRoles: string[] = callerProfile?.roles ?? []

    const { email, role, event_id, speaker_name } = await req.json()

    // Validate role
    if (!['organizer', 'participant', 'speaker'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Role inválida. Use: organizer, participant ou speaker' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authorization checks
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
        return new Response(JSON.stringify({ error: 'event_id é obrigatório para convites de palestrantes' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Organizer must own the event (for participant and speaker invites)
    if ((role === 'participant' || role === 'speaker') && event_id) {
      if (callerRoles.includes('organizer') && !callerRoles.includes('super_admin')) {
        const { data: eventOwner } = await supabaseAdmin
          .from('events')
          .select('id')
          .eq('id', event_id)
          .eq('organizer_id', user.id)
          .single()

        if (!eventOwner) {
          return new Response(JSON.stringify({ error: 'Organizador só pode convidar para seus próprios eventos' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Speaker-specific: create speaker record first
    let speakerId: string | null = null

    if (role === 'speaker') {
      const speakerDisplayName = speaker_name || email.split('@')[0].replace(/[._]/g, ' ')

      // Check if speaker with this email already exists
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

    // 1. Create invitation record
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

    // 2. Invite user via Supabase Auth (sends email automatically)
    // SITE_URL must be set in Supabase Edge Function secrets for production
    const siteUrl = Deno.env.get('SITE_URL')
    if (!siteUrl) {
      console.warn('SITE_URL not set — invitation email will contain localhost link. Set SITE_URL in Edge Function secrets.')
    }
    const redirectBase = siteUrl || 'http://localhost:3000'

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${redirectBase}/auth/set-password?token=${invitation.token}`,
        data: {
          full_name: role === 'speaker' ? (speaker_name || '') : '',
          role: role,
          invitation_token: invitation.token,
        },
      },
    )

    if (inviteError) {
      // User already exists in auth — try generating a magic link instead
      if (inviteError.message?.includes('already been registered') ||
          inviteError.message?.includes('already exists') ||
          inviteError.message?.includes('already been invited')) {

        // Try to send a magic link so user can still set their password
        const { error: magicError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: `${redirectBase}/auth/set-password?token=${invitation.token}`,
          },
        })

        if (magicError) {
          // Still return success — the invitation record was created
          return new Response(JSON.stringify({
            success: true,
            invitation_id: invitation.id,
            speaker_id: speakerId,
            message: `Usuario ja existe. Convite criado — pode entrar com credenciais existentes.`,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({
          success: true,
          invitation_id: invitation.id,
          speaker_id: speakerId,
          message: `Email reenviado para ${email}`,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ error: inviteError.message }), {
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
