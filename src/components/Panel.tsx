import type { HTMLAttributes, ReactNode } from 'react'

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  tone?: 'default' | 'raised' | 'quiet'
}

export default function Panel({ children, className = '', tone = 'default', ...props }: PanelProps) {
  return (
    <div className={`ui-panel ui-panel--${tone} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
