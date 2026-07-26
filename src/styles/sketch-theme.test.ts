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

  it('uses Gothic for functional text and handwriting only for decoration', () => {
    expect(themeCss).toContain('--font-ui:')
    expect(themeCss).toContain('--font-note:')
    expect(ruleFor('body')).toContain('font-family: var(--font-ui)')

    for (const selector of [
      '.dialogue-box__line',
      '.retro-button',
      '.playlist-input-panel',
      '.playlist-extraction-review',
      '.camera-capture__panel',
      '.final-mixtape__card',
    ]) {
      expect(themeCss).toContain(selector)
    }

    expect(themeCss).toContain('.room-stage::before')
    expect(themeCss).toContain('.room-wall-mark')
    expect(themeCss).toContain('.final-mixtape__signature')
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

  it('keeps decoration on the room and gives only dialogue an opaque paper surface', () => {
    expect(ruleFor('.room-stage::after')).toContain('opacity: 0.48')
    expect(ruleFor('.dialogue-box')).toContain(
      'background: var(--sketch-paper-bright)',
    )
    expect(ruleFor('.dialogue-box')).toContain(
      'border: var(--control-stroke) solid var(--sketch-ink)',
    )
    expect(themeCss).not.toContain('.room-interface')
  })

  it('keeps the original open upload and hand-drawn action treatment', () => {
    expect(themeCss).toContain('.file-dropzone,')
    expect(ruleFor('.file-dropzone')).toContain('border-style: dashed')
    expect(themeCss).toContain('.retro-button,')
    expect(themeCss).toContain('border: var(--control-stroke) solid var(--sketch-ink)')
  })

  it('includes interaction and accessibility safeguards', () => {
    expect(themeCss).toContain('pointer-events: none')
    expect(themeCss).toContain(':focus-visible')
    expect(themeCss).toContain('@media (max-width: 760px)')
    expect(themeCss).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps one responsive room composition without split-layout breakpoints', () => {
    expect(ruleFor('.room-stage')).toContain('min-height: 39rem')
    expect(ruleFor('.room-stage')).not.toContain('grid-template-columns')
    expect(themeCss).toContain('@media (max-width: 760px)')
    expect(themeCss).not.toContain('@media (max-width: 1099px)')
    expect(themeCss).not.toContain('@media (max-width: 900px)')
    expect(themeCss).not.toContain('.room-stage--with-interface')
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

  it('uses the Gothic UI role for late-flow controls and result content', () => {
    for (const selector of [
      '.vinyl-interaction__hint',
      '.camera-capture__panel',
      '.photo-review__panel',
      '.mixtape-overlay__card',
      '.final-mixtape__card',
      '.platform-listen__button',
    ]) {
      expect(ruleFor(selector)).toContain('font-family: var(--font-ui)')
    }

    expect(ruleFor('.camera-capture__panel')).toContain('background: var(--sketch-paper)')
    expect(ruleFor('.final-mixtape__card')).toContain('background: var(--sketch-paper)')
  })
})
