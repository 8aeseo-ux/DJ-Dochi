import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { DUMMY_TRACKS } from '../data/playlist'
import PlatformListenButtons from './PlatformListenButtons'

afterEach(cleanup)

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

    const midnightCityLink = screen.getByRole('link', { name: 'Spotify에서 Midnight City 듣기' })
    expect(midnightCityLink).toHaveAttribute(
      'href',
      'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
    )
    expect(midnightCityLink).toHaveAttribute('target', '_blank')
    expect(midnightCityLink).toHaveAttribute('rel', 'noreferrer')

    await user.click(screen.getByRole('button', { name: 'Apple Music에서 듣기' }))

    expect(screen.queryByRole('region', { name: 'Spotify 추천곡' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Apple Music 추천곡' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apple Music에서 Midnight City 듣기' })).toHaveAttribute(
      'href',
      'https://music.apple.com/kr/album/midnight-city/1674216738?i=1674217008',
    )
  })

  it('keeps future unresolved recommendations usable through search', async () => {
    const user = userEvent.setup()
    const unresolvedTrack = {
      ...DUMMY_TRACKS[0],
      title: 'Future Song',
      artist: 'Future Artist',
      platforms: {
        spotify: { id: null, url: null },
        appleMusic: { id: null, url: null },
        youtubeMusic: { id: null, url: null },
      },
    }

    render(<PlatformListenButtons tracks={[unresolvedTrack]} />)
    await user.click(screen.getByRole('button', { name: 'Spotify에서 듣기' }))

    expect(screen.getByRole('link', { name: 'Spotify에서 Future Song 찾기' })).toHaveAttribute(
      'href',
      'https://open.spotify.com/search/Future%20Artist%20Future%20Song',
    )
  })
})
