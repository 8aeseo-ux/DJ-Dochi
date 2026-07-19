import type { ReactNode } from 'react'
import RetroButton from './RetroButton'

export type ChoiceMenuItem = {
  label: ReactNode
  onSelect: () => void
  variant?: 'primary' | 'secondary'
}

type ChoiceMenuProps = {
  items: ChoiceMenuItem[]
}

export default function ChoiceMenu({ items }: ChoiceMenuProps) {
  return (
    <div className="choice-menu" role="group" aria-label="도치의 선택지">
      {items.map((item) => (
        <RetroButton key={String(item.label)} variant={item.variant} onClick={item.onSelect}>
          {item.label}
        </RetroButton>
      ))}
    </div>
  )
}
