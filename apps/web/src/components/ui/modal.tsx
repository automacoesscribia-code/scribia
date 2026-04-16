'use client'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-bg2 border border-border-subtle rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg sm:text-xl font-bold text-text mb-4 sm:mb-5">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
