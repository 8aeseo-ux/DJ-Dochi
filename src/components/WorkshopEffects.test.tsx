import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import WorkshopEffects from './WorkshopEffects'

afterEach(cleanup)

describe('WorkshopEffects', () => {
  it('exposes energy and intensity before recording begins', () => {
    render(
      <WorkshopEffects
        active
        message="조금만 더!"
        energy={0.82}
        intensity={0.75}
        nearCompletion
      />,
    )

    const workshopEffects = screen.getByTestId('workshop-effects')
    expect(workshopEffects).toHaveClass('workshop-effects--active')
    expect(workshopEffects).toHaveClass('workshop-effects--near-complete')
    expect(workshopEffects).toHaveStyle('--workshop-energy: 0.82')
    expect(workshopEffects).toHaveStyle('--workshop-intensity: 0.75')
    expect(screen.getByText('조금만 더!')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '작업실 이퀄라이저' })).toBeInTheDocument()
    expect(screen.getByTestId('cassette-reels')).toBeInTheDocument()
    expect(screen.getByTestId('rec-lamp')).not.toHaveClass('workshop-effects__rec--on')
  })

  it('turns REC on and fully spins the cassette reels while recording', () => {
    render(
      <WorkshopEffects
        active
        message="REC / Recording..."
        energy={1}
        intensity={1}
        nearCompletion
        recording
      />,
    )

    expect(screen.getByTestId('workshop-effects')).toHaveClass('workshop-effects--recording')
    expect(screen.getByTestId('rec-lamp')).toHaveClass('workshop-effects__rec--on')
    expect(screen.getByTestId('cassette-reels')).toHaveClass('workshop-effects__cassette--recording')
  })
})
