import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Login } from './pages/Login'
import { EventSelection } from './pages/EventSelection'
import { SpeakerLectures } from './pages/SpeakerLectures'
import { RecordingSession } from './pages/RecordingSession'
import type { User } from '@supabase/supabase-js'
import './App.css'

type Screen =
  | { type: 'login' }
  | { type: 'events'; returnToEventId?: string; returnToEventName?: string }
  | { type: 'speaker-lectures' }
  | { type: 'recording'; eventId: string; lectureId: string; lectureTitle: string; eventName: string }

type UserRole = 'super_admin' | 'organizer' | 'speaker' | 'participant'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [screen, setScreen] = useState<Screen>({ type: 'login' })
  const [loading, setLoading] = useState(true)

  async function loadUserProfile(authUser: User) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, roles')
      .eq('id', authUser.id)
      .single()

    const roles = (profile as { roles: string[]; full_name: string } | null)?.roles ?? []
    const fullName = (profile as { full_name: string } | null)?.full_name || authUser.email?.split('@')[0] || 'Usuário'

    setUserName(fullName)

    // Determine primary role (priority: super_admin > organizer > speaker > participant)
    let primary: UserRole = 'participant'
    if (roles.includes('super_admin')) primary = 'super_admin'
    else if (roles.includes('organizer')) primary = 'organizer'
    else if (roles.includes('speaker')) primary = 'speaker'

    setUserRole(primary)

    // Route based on role
    if (primary === 'speaker') {
      setScreen({ type: 'speaker-lectures' })
    } else {
      setScreen({ type: 'events' })
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user)
        loadUserProfile(user).then(() => setLoading(false)).catch(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (!authUser) {
        setScreen({ type: 'login' })
        setUserRole(null)
        setUserName('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      await loadUserProfile(user)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setScreen({ type: 'login' })
    setUser(null)
    setUserRole(null)
    setUserName('')
  }

  function handleSelectLecture(eventId: string, lectureId: string, lectureTitle: string, eventName: string) {
    setScreen({ type: 'recording', eventId, lectureId, lectureTitle, eventName })
  }

  function handleBackFromRecording() {
    if (userRole === 'speaker') {
      setScreen({ type: 'speaker-lectures' })
    } else {
      // Return to the event the user was on, not the event list
      const currentScreen = screen
      if (currentScreen.type === 'recording') {
        setScreen({ type: 'events', returnToEventId: currentScreen.eventId, returnToEventName: currentScreen.eventName })
      } else {
        setScreen({ type: 'events' })
      }
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div className="logo" style={{ fontSize: 24 }}>SCRIBIA</div>
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Carregando...</p>
      </div>
    )
  }

  if (screen.type === 'login' || !user) {
    return <Login onLogin={handleLogin} />
  }

  if (screen.type === 'recording') {
    return (
      <RecordingSession
        eventId={screen.eventId}
        lectureId={screen.lectureId}
        lectureTitle={screen.lectureTitle}
        eventName={screen.eventName}
        onBack={handleBackFromRecording}
      />
    )
  }

  if (screen.type === 'speaker-lectures' && user) {
    return (
      <SpeakerLectures
        userId={user.id}
        userName={userName}
        onSelectLecture={handleSelectLecture}
        onLogout={handleLogout}
      />
    )
  }

  // Default: organizer/super_admin event selection
  return (
    <EventSelection
      onSelectLecture={handleSelectLecture}
      onLogout={handleLogout}
      returnToEventId={screen.type === 'events' ? screen.returnToEventId : undefined}
      returnToEventName={screen.type === 'events' ? screen.returnToEventName : undefined}
    />
  )
}

export default App
