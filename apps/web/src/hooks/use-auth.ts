'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

type UserRole = 'super_admin' | 'organizer' | 'participant'

interface UserProfile {
  id: string
  email: string
  full_name: string
  roles: UserRole[]
  avatar_url: string | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function getSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(data as UserProfile | null)
      }

      setIsLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data as UserProfile | null)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signIn = useCallback(
    async (email: string, password: string) => {
      return supabase.auth.signInWithPassword({ email, password })
    },
    [supabase],
  )

  const signUp = useCallback(
    async (email: string, password: string, metadata?: { full_name?: string; role?: string }) => {
      return supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      })
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [supabase])

  return { user, profile, isLoading, signIn, signUp, signOut }
}
