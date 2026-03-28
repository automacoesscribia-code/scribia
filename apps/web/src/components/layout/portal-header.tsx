'use client'

import { UserMenu } from './user-menu'

interface PortalHeaderProps {
  userName: string
  eventName: string
}

export function PortalHeader({ userName, eventName }: PortalHeaderProps) {
  return (
    <nav className="bg-bg2 border-b border-border-subtle px-10 flex items-center justify-between h-14 sticky top-0 z-10">
      <div className="font-heading font-extrabold text-xl text-purple-light tracking-tight">
        SCRIBIA
      </div>
      <div className="bg-bg3 border border-border-subtle rounded-full px-3.5 py-1 text-[12px] text-text2">
        {eventName}
      </div>
      <UserMenu userName={userName} userRole="Participante" variant="navbar" />
    </nav>
  )
}
