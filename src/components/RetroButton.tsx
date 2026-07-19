import type { ButtonHTMLAttributes, ReactNode } from 'react'

type RetroButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

export default function RetroButton({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: RetroButtonProps) {
  return (
    <button
      className={`retro-button retro-button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      <span>{children}</span>
      <span className="retro-button__arrow" aria-hidden="true">↗</span>
    </button>
  )
}
