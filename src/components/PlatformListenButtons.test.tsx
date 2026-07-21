import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DUMMY_TRACKS } from '../data/playlist'
import PlatformListenButtons from './PlatformListenButtons'

describe('PlatformListenButtons', () => {
  it('opens a real external link list for the selected music app', async () => {
    const user = userEvent.setup()

    render(<PlatformListenButtons tracks={DUMMY_TRACKS} />)

    expect(screen.getByRole('group', { name: '음악 앱에서 듣기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spotify에서 듣기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apple Music에서 듣기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'YouTube Music에서 듣기' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Spotify에서 듣기' }))

    expect(screen.getByRole('button', { name: 'Spotify에서 듣기' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: 'Spotify 추천곡' })).toBeInTheDocument()

    const midnightCityLink = screen.getByRole('link', { name: 'Spotify에서 Midnight City 찾기' })
    expect(midnightCityLink).toHaveAttribute(
      'href',
      'https://open.spotify.com/search/M83%20Midnight%20City',
    )
    expect(midnightCityLink).toHaveAttribute('target', '_blank')
    expect(midnightCityLink).toHaveAttribute('rel', 'noreferrer')

    await user.click(screen.getByRole('button', { name: 'Apple Music에서 듣기' }))

    expect(screen.queryByRole('region', { name: 'Spotify 추천곡' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Apple Music 추천곡' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apple Music에서 Midnight City 찾기' })).toHaveAttribute(
      'href',
      'https://music.apple.com/kr/search?term=M83%20Midnight%20City',
    )
  })
})
