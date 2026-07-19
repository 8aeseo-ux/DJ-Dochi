import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Panel from './Panel'

describe('Panel', () => {
  it('renders content through a replaceable surface component', () => {
    render(<Panel tone="raised">Playlist preview</Panel>)

    const content = screen.getByText('Playlist preview')
    expect(content).toBeInTheDocument()
    expect(content.closest('.ui-panel')).toHaveClass('ui-panel', 'ui-panel--raised')
  })
})
