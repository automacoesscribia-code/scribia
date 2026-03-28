'use client'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-bg2 border border-border-subtle rounded-2xl p-6 w-full max-w-lg animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-xl font-bold text-text mb-5">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
