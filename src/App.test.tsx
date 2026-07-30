import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DUMMY_MIXTAPE_RESULT } from './data/playlist'
import { VINYL_PHYSICS } from './lib/vinylPhysics'

vi.mock('./components/PolaroidComposer', () => ({
  default: ({ onComplete }: { onComplete: (polaroidUrl: string) => void }) => (
    <div data-testid="polaroid-composer">
      <button type="button" onClick={() => onComplete('data:image/png;base64,polaroid')}>폴라로이드 완성</button>
    </div>
  ),
}))

function installAnimationFrame() {
  let time = 0
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId
    nextId += 1
    callbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))

  return {
    step(frameCount = 1, deltaMs = VINYL_PHYSICS.FRAME_MS) {
      act(() => {
        for (let frame = 0; frame < frameCount; frame += 1) {
          time += deltaMs
          const pending = [...callbacks.values()]
          callbacks.clear()
          pending.forEach((callback) => callback(time))
        }
      })
    },
  }
}

function prepareVinyl(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 200,
    width: 200,
    height: 200,
    toJSON: () => ({}),
  })
}

function dispatchVinylPointer(element: HTMLElement, type: string, x: number, y: number, time: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: 'mouse' },
    timeStamp: { value: time },
  })
  fireEvent(element, event)
}

async function finishIntro(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'DJ 도치 idle' }))

  const lines = [
    '엇?',
    '언제부터 거기 있었어?',
    '...아무튼 잘 왔어.',
    '요즘 자주 듣는 음악 좀 보여줄래?',
    '네 취향이랑 비슷한 곡들로 테이프 하나 만들어볼게.',
  ]

  for (const line of lines) {
    const dialogue = screen.getByRole('button', { name: '도치의 대화' })
    await user.click(dialogue)
    expect(dialogue).toHaveTextContent(line)
    await user.click(dialogue)
  }
}

function finishIntroWithEvents() {
  fireEvent.click(screen.getByRole('button', { name: 'DJ 도치 idle' }))

  const lines = [
    '엇?',
    '언제부터 거기 있었어?',
    '...아무튼 잘 왔어.',
    '요즘 자주 듣는 음악 좀 보여줄래?',
    '네 취향이랑 비슷한 곡들로 테이프 하나 만들어볼게.',
  ]

  for (const line of lines) {
    const dialogue = screen.getByRole('button', { name: '도치의 대화' })
    fireEvent.click(dialogue)
    expect(dialogue).toHaveTextContent(line)
    fireEvent.click(dialogue)
  }
}

describe('DJ DOCHI fixed-room flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    const createObjectURL = vi.fn(() => 'blob:dochi-preview')
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts in one room without a progress rail or a large page title', () => {
    render(<App />)

    expect(document.querySelector('.dochi-room')).toBeInTheDocument()
    expect(screen.getByText('DJ DOCHI')).toBeInTheDocument()
    expect(screen.getByText('도치를 눌러보세요')).toBeInTheDocument()
    expect(document.querySelector('.progress-rail')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'START SESSION' })).not.toBeInTheDocument()
    expect(screen.queryByText("Let's find your frequency")).not.toBeInTheDocument()
  })

  it('keeps independent BGM and dialogue SFX controls in the topbar without changing the room flow', () => {
    render(<App />)

    const bgmSettings = screen.getByRole('button', { name: '배경음악 설정 열기' })
    const soundToggle = screen.getByRole('button', { name: '대화 효과음 끄기' })
    expect(bgmSettings.closest('.topbar')).toBeInTheDocument()
    expect(soundToggle.closest('.topbar')).toBeInTheDocument()

    fireEvent.click(bgmSettings)
    fireEvent.click(screen.getByRole('button', { name: '배경음악 끄기' }))
    fireEvent.click(soundToggle)

    expect(localStorage.getItem('dj-dochi:bgm-enabled')).toBe('false')
    expect(screen.getByRole('button', { name: '대화 효과음 켜기' })).toBeInTheDocument()
    expect(localStorage.getItem('dj-dochi:sfx-enabled')).toBe('false')
    expect(screen.getByText('도치를 눌러보세요')).toBeInTheDocument()
  })

  it('uses the supplied idle character asset and keeps the controller in front', () => {
    render(<App />)

    expect(screen.getByRole('img', { name: 'DJ 도치 idle' })).toHaveAttribute('src', expect.stringContaining('dochi-idle-01.webp'))
    const controller = screen.getByTestId('dj-controller')
    expect(controller).toHaveClass('room-controller')
    expect(controller).toHaveAttribute('aria-label', 'DJ 컨트롤러')
    expect(controller.querySelector('img')).toHaveAttribute('src', expect.stringContaining('dj-controller.webp'))
  })

  it('keeps scene objects and dialogue in one persistent room stage', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const stage = container.querySelector('.room-stage')

    expect(stage).toBeInTheDocument()
    expect(container.querySelector('.room-visual')).not.toBeInTheDocument()
    expect(container.querySelector('.room-interface')).not.toBeInTheDocument()
    expect(stage).not.toHaveClass('room-stage--with-interface')
    expect(stage?.querySelector('.room-character')).toBeInTheDocument()
    expect(stage?.querySelector('.room-controller-layer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'DJ 도치 idle' }))

    expect(stage).toContainElement(
      screen.getByRole('button', { name: '도치의 대화' }),
    )
  })

  it('opens the input panel over the unchanged room after the dialogue', async () => {
    const user = userEvent.setup()
    render(<App />)

    await finishIntro(user)
    await user.click(screen.getByRole('button', { name: '음악 목록 적어주기' }))

    expect(screen.getByRole('dialog', { name: '플레이리스트 입력' })).toBeInTheDocument()
    expect(screen.getByText('DJ DOCHI')).toBeInTheDocument()
    expect(document.querySelector('.dochi-room')).toBeInTheDocument()
    expect(screen.getByLabelText('음악 목록')).toBeInTheDocument()
  })

  it('keeps the room mounted while the user spins the LP, records, and opens the tape', async () => {
    vi.useFakeTimers()
    const raf = installAnimationFrame()
    render(<App />)

    finishIntroWithEvents()
    fireEvent.click(screen.getByRole('button', { name: '음악 목록 적어주기' }))
    fireEvent.change(screen.getByLabelText('음악 목록'), { target: { value: 'Beach House - Space Song' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => DUMMY_MIXTAPE_RESULT,
    }))
    fireEvent.click(screen.getByRole('button', { name: '도치에게 건네기' }))

    expect(screen.queryByRole('dialog', { name: '플레이리스트 입력' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '추출한 음악 목록 확인' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '이 목록이 맞아' }))
    await act(async () => {
      for (let tick = 0; tick < 10; tick += 1) await Promise.resolve()
    })

    const handoffLines = ['좋아.', '이제 같이 믹스를 시작해보자.']
    for (const line of handoffLines) {
      const handoffDialogue = screen.getByRole('button', { name: '도치의 대화' })
      fireEvent.click(handoffDialogue)
      expect(handoffDialogue).toHaveTextContent(line)
      fireEvent.click(handoffDialogue)
    }

    expect(screen.getByRole('slider', { name: 'LP를 돌려 믹스를 시작하세요' })).toBeInTheDocument()
    expect(screen.getByText('DJ DOCHI')).toBeInTheDocument()

    const vinyl = screen.getByRole('slider', { name: 'LP를 돌려 믹스를 시작하세요' })
    const stage = document.querySelector('.room-stage')
    const vinylStatus = document.querySelector('.room-vinyl-status')

    expect(stage).toContainElement(vinyl)
    expect(vinylStatus).not.toBeInTheDocument()

    prepareVinyl(vinyl)
    dispatchVinylPointer(vinyl, 'pointerdown', 200, 100, 100)
    dispatchVinylPointer(vinyl, 'pointermove', 100, 200, 140)
    dispatchVinylPointer(vinyl, 'pointerup', 100, 200, 145)

    expect(screen.getByRole('status', { name: '도치의 회전 반응' })).toHaveTextContent('어어어, 너무 잘 돌리는데?!')
    expect(document.querySelector('.room-stage')).toHaveClass('room-stage--overdrive')

    for (let frame = 0; frame < 180 && vinyl.getAttribute('aria-valuenow') !== '100'; frame += 1) {
      raf.step()
    }

    expect(vinyl).toHaveAttribute('aria-valuenow', '100')
    raf.step(Math.ceil(VINYL_PHYSICS.COMPLETION_COAST_MS / VINYL_PHYSICS.FRAME_MS) + 1)

    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByTestId('vinyl-needle')).toHaveClass('vinyl-needle--down')
    expect(screen.queryByText('REC · Recording...')).not.toBeInTheDocument()
    expect(screen.getByTestId('workshop-effects')).toHaveClass('workshop-effects--active')
    expect(document.querySelector('.dochi-character__asset')).toHaveAttribute('src', expect.stringContaining('dochi-thinking.webp'))
    expect(document.querySelector('.dochi-room')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(800))
    expect(screen.getByText('REC · Recording...')).toBeInTheDocument()
    expect(screen.getByTestId('rec-lamp')).toHaveClass('workshop-effects__rec--on')
    act(() => vi.advanceTimersByTime(2_200))
    act(() => vi.advanceTimersByTime(900))
    fireEvent.click(screen.getByRole('button', { name: '도치의 대화' }))
    expect(screen.getByText('됐다.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'DJ 도치 result' })).toBeInTheDocument()
    expect(document.querySelector('.dochi-character__asset')).toHaveAttribute('src', expect.stringContaining('dochi-result.webp'))

    for (let click = 0; click < 4; click += 1) {
      fireEvent.click(screen.getByRole('button', { name: '도치의 대화' }))
    }

    expect(screen.getByRole('button', { name: '기념사진 찍기' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '그냥 받을게' }))
    fireEvent.click(screen.getByRole('button', { name: '도치의 대화' }))
    expect(screen.getByText('좋아.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '도치 기본 스티커' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '믹스테이프 보기' }))

    expect(screen.getByRole('dialog', { name: '도치 믹스테이프' })).toBeInTheDocument()
    expect(screen.getByText("DOCHI'S NIGHT DRIVE")).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '도치 기본 스티커' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '믹스테이프 닫기' }))
    expect(screen.getByText('DJ DOCHI')).toBeInTheDocument()
  })
})
