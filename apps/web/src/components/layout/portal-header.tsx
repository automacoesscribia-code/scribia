'use client'

import { UserMenu } from './user-menu'

interface PortalHeaderProps {
  userName: string
  eventName: string
}

export function PortalHeader({ userName, eventName }: PortalHeaderProps) {
  return (
    <nav className="bg-bg2 border-b border-border-subtle px-4 sm:px-6 md:px-10 flex items-center justify-between gap-3 h-14 sticky top-0 z-10">
      <div className="font-heading font-extrabold text-lg sm:text-xl text-purple-light tracking-tight shrink-0">
        SCRIBIA
      </div>
      <div className="hidden sm:block bg-bg3 border border-border-subtle rounded-full px-3.5 py-1 text-[12px] text-text2 truncate max-w-[50vw]">
        {eventName}
      </div>
      <UserMenu userName={userName} userRole="Participante" variant="navbar" />
    </nav>
  )
}
