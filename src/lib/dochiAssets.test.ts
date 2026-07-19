import { describe, expect, it } from 'vitest'
import { DOCHI_ASSET_FILENAMES, DOCHI_IDLE_ASSET_FILENAMES } from './dochiAssets'

describe('Dochi image assets', () => {
  it('maps every character pose to the supplied webp asset', () => {
    expect(DOCHI_ASSET_FILENAMES).toEqual({
      idle: 'dochi-idle.webp',
      surprised: 'dochi-noticed.webp',
      thinking: 'dochi-thinking.webp',
      result: 'dochi-result.webp',
    })
  })

  it('keeps the idle frame sequence explicit and replaceable', () => {
    expect(DOCHI_IDLE_ASSET_FILENAMES).toEqual([
      'dochi-idle-01.webp',
      'dochi-idle-02.webp',
    ])
  })
})
