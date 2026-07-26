// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const themeCss = readFileSync(new URL('./sketch-theme.css', import.meta.url), 'utf8')
const workshopDoodlesUrl = new URL(
  '../assets/sketch/workshop-doodles.svg',
  import.meta.url,
)
const workshopDoodles = existsSync(workshopDoodlesUrl)
  ? readFileSync(workshopDoodlesUrl, 'utf8')
  : ''

function ruleFor(selector: string) {
  const start = themeCss.indexOf(`${selector} {`)
  if (start < 0) return ''
  const end = themeCss.indexOf('}', start)
  return themeCss.slice(start, end + 1)
}

describe('music sketchbook work note theme', () => {
  it('loads local Gothic UI text before decorative handwriting and theme overrides', () => {
    expect(indexCss).toContain("@import 'pretendard/dist/web/static/pretendard.css'")
    expect(indexCss).toContain("@import '@fontsource/gaegu/400.css'")
    expect(indexCss).toContain("@import '@fontsource/gaegu/700.css'")
    expect(indexCss.indexOf("pretendard/dist/web/static/pretendard.css"))
      .toBeLessThan(indexCss.indexOf("@fontsource/gaegu/400.css"))
    expect(indexCss.indexOf("@fontsource/gaegu/700.css"))
      .toBeLessThan(indexCss.indexOf("./styles/dj-dochi.css"))
    expect(indexCss.indexOf("./styles/sketch-theme.css"))
      .toBeGreaterThan(indexCss.indexOf("./styles/dj-dochi.css"))
  })

  it('separates readable UI typography from decorative notes', () => {
    expect(themeCss).toContain('--font-ui:')
    expect(themeCss).toContain('--font-note:')
    expect(themeCss).toContain('font-family: var(--font-ui)')
    expect(themeCss).toContain('.room-visual::before')
    expect(themeCss).toContain('font-family: var(--font-note)')
  })

  it('defines an unruled ink sketchbook palette', () => {
    for (const token of [
      '--sketch-paper',
      '--sketch-ink',
      '--sketch-pencil',
      '--sketch-red',
      '--sketch-blue',
      '--sketch-yellow',
      '--font-note',
    ]) {
      expect(themeCss).toContain(token)
    }

    expect(themeCss).not.toContain('--paper-shadow')
    expect(themeCss).not.toContain('--notebook-line-blue')
    expect(themeCss).not.toContain('--notebook-margin-red')
  })

  it('keeps the structural and workflow surface contracts', () => {
    for (const selector of [
      '.app-shell',
      '.room-stage',
      '.room-character',
      '.room-controller-layer',
      '.dialogue-box',
      '.choice-menu',
      '.playlist-input-panel',
      '.playlist-extraction-review',
      '.vinyl-interaction',
      '.camera-capture__panel',
      '.final-mixtape__card',
      '.platform-listen__button',
    ]) {
      expect(themeCss).toContain(selector)
    }
  })

  it('keeps scene decoration inside the visual layer and the UI on opaque paper', () => {
    expect(ruleFor('.room-visual::after')).toContain('opacity: 0.14')
    expect(ruleFor('.room-interface')).toContain('background: var(--sketch-paper-bright)')
    expect(ruleFor('.room-interface--empty')).toContain('display: none')
  })

  it('keeps upload and action surfaces clean and readable', () => {
    expect(ruleFor('.file-dropzone')).toContain('background: var(--sketch-paper-bright)')
    expect(ruleFor('.file-dropzone')).not.toContain('gradient')
    expect(ruleFor('.retro-button')).toContain('min-height: 44px')
  })

  it('includes interaction and accessibility safeguards', () => {
    expect(themeCss).toContain('pointer-events: none')
    expect(themeCss).toContain(':focus-visible')
    expect(themeCss).toContain('@media (max-width: 760px)')
    expect(themeCss).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('uses one hand-drawn workshop SVG without interactive behavior', () => {
    expect(workshopDoodles).toContain('<svg')
    expect(workshopDoodles).toContain('stroke="currentColor"')
    expect(workshopDoodles).toContain('fill="none"')
    expect(themeCss).toContain("url('../assets/sketch/workshop-doodles.svg')")
    expect(themeCss).toContain('pointer-events: none')
  })

  it('uses open composition and thin control boundaries', () => {
    expect(themeCss).toContain('--control-stroke: 1.4px')
    expect(themeCss).toContain('.dialogue-box')
    expect(themeCss).toContain('border-width: 0 0 1.5px')
    expect(themeCss).toContain('.retro-button')
    expect(themeCss).toContain('border: var(--control-stroke) solid')
    expect(themeCss).not.toContain('--paper-shadow-small')
  })

  it('removes collage decorations from workflow surfaces', () => {
    expect(themeCss).toContain('.playlist-input-panel::before')
    expect(themeCss).toContain('.playlist-extraction-review::before')
    expect(themeCss).toContain('.dialogue-box::before')
    expect(themeCss).toContain('content: none')
    expect(themeCss).not.toContain('masking-tape')
  })

  it('keeps late-flow tools on the same sketchbook page', () => {
    expect(themeCss).toContain('.vinyl-interaction__record')
    expect(themeCss).toContain('#25231f')
    expect(themeCss).toContain('.camera-capture__panel')
    expect(themeCss).toContain('.photo-review__panel')
    expect(themeCss).toContain('.final-mixtape__card')
    expect(themeCss).toContain('.platform-listen__track-link')
    expect(themeCss).not.toContain('box-shadow: 8px 10px')
  })
})
