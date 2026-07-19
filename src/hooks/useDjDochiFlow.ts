import { useEffect, useRef, useState } from 'react'
import type { SpinFeedbackBand, SpinMetrics } from '../lib/vinylPhysics'
import type { DochiFlowState, InputMode, PhotoData, PlaylistInput } from '../types'

const CELEBRATION_DURATION_MS = 1_000
const NEEDLE_DROP_DURATION_MS = 800
const RECORDING_DURATION_MS = 2_200
const RETURN_DURATION_MS = 900
const OVERDRIVE_REACTION_MS = 420

const INTRO_LINES = [
  '엇?',
  '언제부터 거기 있었어?',
  '...아무튼 잘 왔어.',
  '요즘 자주 듣는 음악 좀 보여줄래?',
  '네 취향이랑 비슷한 곡들로 테이프 하나 만들어볼게.',
] as const

const RETURN_LINES = [
  '기다렸어?',
  '네가 듣던 분위기는 남겨두고,',
  '조금 새로운 것도 섞어봤어.',
  '자. 네 거야.',
] as const

const HANDOFF_LINES = ['좋아.', '이제 같이 믹스를 시작해보자.'] as const
const PHOTO_PROMPT_LINES = ['됐다.', '근데 아직 하나 부족해.', '우리 기념사진 하나 찍을래?'] as const
const FINAL_TAPE_LINES = ['좋아.', '이제 진짜 우리 테이프다.'] as const

const SPIN_REACTIONS: Record<Exclude<SpinFeedbackBand, 'idle'>, readonly string[]> = {
  slow: ['조금 더 세게!', '그 정도로는 테이프가 안 돌아가.'],
  medium: ['좋아, 감 잡았어.', '조금만 더!'],
  fast: ['오오오!', '그래, 바로 그거야!'],
  overdrive: ['어어어, 너무 잘 돌리는데?!'],
}

type DialogueTrack = 'intro' | 'handoff' | 'photoPrompt' | 'finalTape' | 'return' | null

export type DjDochiFlowActions = {
  notice: () => void
  advanceDialogue: () => void
  chooseImage: () => void
  chooseText: () => void
  selectImage: (file: File) => void
  updateText: (value: string) => void
  deleteInput: () => void
  closeInput: () => void
  handoff: () => void
  updateSpinEnergy: (energy: number) => void
  updateSpinMetrics: (metrics: SpinMetrics) => void
  completeSpin: () => void
  acceptPhoto: () => void
  capturePhoto: (photoUrl: string) => void
  retakePhoto: () => void
  usePhoto: () => void
  skipPhoto: () => void
  completePolaroid: (polaroidUrl: string) => void
  openTape: () => void
  closeTape: () => void
  restart: () => void
}

export type DjDochiFlow = {
  state: DochiFlowState
  dialogue: { speaker: 'dochi'; text: string; index: number; total: number } | null
  dialogueKey: string
  inputMode: InputMode
  input: PlaylistInput
  hasInput: boolean
  workMessage: string | null
  spinEnergy: number
  spinIntensity: number
  spinReaction: string | null
  isOverdrive: boolean
  capturedPhotoUrl: PhotoData
  polaroidUrl: PhotoData
  actions: DjDochiFlowActions
}

function createInitialInput(): PlaylistInput {
  return { imageFile: null, imageUrl: null, pastedText: '' }
}

function getDialogueLines(track: Exclude<DialogueTrack, null>) {
  if (track === 'intro') return INTRO_LINES
  if (track === 'handoff') return HANDOFF_LINES
  if (track === 'photoPrompt') return PHOTO_PROMPT_LINES
  if (track === 'finalTape') return FINAL_TAPE_LINES
  return RETURN_LINES
}

export function useDjDochiFlow(): DjDochiFlow {
  const [state, setState] = useState<DochiFlowState>('idle')
  const [dialogueTrack, setDialogueTrack] = useState<DialogueTrack>(null)
  const [dialogueIndex, setDialogueIndex] = useState(0)
  const [inputMode, setInputMode] = useState<InputMode>(null)
  const [input, setInput] = useState<PlaylistInput>(() => createInitialInput())
  const [spinEnergy, setSpinEnergy] = useState(0)
  const [spinIntensity, setSpinIntensity] = useState(0)
  const [spinReaction, setSpinReaction] = useState<string | null>(null)
  const [isOverdrive, setIsOverdrive] = useState(false)
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<PhotoData>(null)
  const [polaroidUrl, setPolaroidUrl] = useState<PhotoData>(null)
  const inputRef = useRef(input)
  const reactionBandRef = useRef<SpinFeedbackBand>('idle')
  const reactionVariantRef = useRef(0)
  const overdriveTimerRef = useRef<number | null>(null)

  inputRef.current = input

  const replaceInput = (nextInput: PlaylistInput) => {
    inputRef.current = nextInput
    setInput(nextInput)
  }

  const resetInput = () => replaceInput(createInitialInput())
  const hasInput = Boolean(input.imageUrl || input.pastedText.trim())
  const dialogueLines = dialogueTrack ? getDialogueLines(dialogueTrack) : null
  const dialogue = dialogueLines
    ? {
        speaker: 'dochi' as const,
        text: dialogueLines[dialogueIndex],
        index: dialogueIndex,
        total: dialogueLines.length,
      }
    : null
  const dialogueKey = dialogueTrack ? `${dialogueTrack}-${dialogueIndex}` : 'none'
  const workMessage = state === 'working'
    ? 'SPIN TO CHARGE'
    : state === 'recordingIntro'
      ? 'MIX ENERGY / LOCKED'
      : state === 'needleDropping'
        ? 'NEEDLE DOWN'
        : state === 'recording'
          ? 'REC / Recording...'
          : null

  const actions: DjDochiFlowActions = {
    notice: () => {
      if (state !== 'idle') return
      setDialogueTrack('intro')
      setDialogueIndex(0)
      setState('noticed')
    },
    advanceDialogue: () => {
      if (!dialogueTrack) return
      const lines = getDialogueLines(dialogueTrack)

      if (dialogueIndex < lines.length - 1) {
        setDialogueIndex((current) => current + 1)
        if (dialogueTrack === 'intro') setState('talking')
        return
      }

      if (dialogueTrack === 'intro') setState('choosingInput')
      if (dialogueTrack === 'handoff') {
        setDialogueTrack(null)
        setSpinEnergy(0)
        setState('working')
      }
    },
    chooseImage: () => {
      if (state !== 'choosingInput') return
      resetInput()
      setInputMode('image')
    },
    chooseText: () => {
      if (state !== 'choosingInput') return
      resetInput()
      setInputMode('text')
    },
    selectImage: (file) => {
      if (!file.type.startsWith('image/')) return
      replaceInput({ imageFile: file, imageUrl: URL.createObjectURL(file), pastedText: '' })
      setInputMode('image')
    },
    updateText: (value) => {
      replaceInput({ ...inputRef.current, pastedText: value })
    },
    deleteInput: () => {
      resetInput()
      setInputMode(null)
    },
    closeInput: () => {
      resetInput()
      setInputMode(null)
    },
    handoff: () => {
      const nextHasInput = Boolean(inputRef.current.imageUrl || inputRef.current.pastedText.trim())
      if (!nextHasInput || state !== 'choosingInput') return
      setInputMode(null)
      setDialogueTrack('handoff')
      setDialogueIndex(0)
      setState('receivingInput')
    },
    updateSpinEnergy: (energy) => {
      if (state !== 'working') return
      setSpinEnergy(Math.min(1, Math.max(0, energy)))
    },
    updateSpinMetrics: (metrics) => {
      if (state !== 'working') return

      setSpinEnergy(Math.min(1, Math.max(0, metrics.energy)))
      setSpinIntensity(Math.min(1, Math.max(0, metrics.intensity)))

      if (metrics.feedback !== reactionBandRef.current) {
        reactionBandRef.current = metrics.feedback

        if (metrics.feedback === 'idle') {
          setSpinReaction(null)
        } else {
          const lines = SPIN_REACTIONS[metrics.feedback]
          const reaction = lines[reactionVariantRef.current % lines.length]
          reactionVariantRef.current += 1
          setSpinReaction(reaction)
        }
      }

      if (metrics.overdrive) {
        setIsOverdrive(true)
        if (overdriveTimerRef.current !== null) window.clearTimeout(overdriveTimerRef.current)
        overdriveTimerRef.current = window.setTimeout(() => setIsOverdrive(false), OVERDRIVE_REACTION_MS)
      }
    },
    completeSpin: () => {
      if (state !== 'working') return
      setSpinEnergy(1)
      setSpinReaction(null)
      setIsOverdrive(false)
      setDialogueTrack(null)
      setState('recordingIntro')
    },
    acceptPhoto: () => {
      if (state !== 'photoPrompt' || dialogueTrack !== 'photoPrompt' || dialogueIndex !== PHOTO_PROMPT_LINES.length - 1) return
      setDialogueTrack(null)
      setState('cameraPreview')
    },
    capturePhoto: (photoUrl) => {
      if (state !== 'cameraPreview' || !photoUrl) return
      setCapturedPhotoUrl(photoUrl)
      setState('photoReview')
    },
    retakePhoto: () => {
      if (state !== 'photoReview') return
      setCapturedPhotoUrl(null)
      setState('cameraPreview')
    },
    usePhoto: () => {
      if (state !== 'photoReview' || !capturedPhotoUrl) return
      setState('polaroidMaking')
    },
    skipPhoto: () => {
      if (state !== 'photoPrompt' && state !== 'cameraPreview') return
      setCapturedPhotoUrl(null)
      setPolaroidUrl(null)
      setDialogueTrack('finalTape')
      setDialogueIndex(0)
      setState('finalTape')
    },
    completePolaroid: (nextPolaroidUrl) => {
      if (state !== 'polaroidMaking' || !nextPolaroidUrl) return
      setPolaroidUrl(nextPolaroidUrl)
      setDialogueTrack('finalTape')
      setDialogueIndex(0)
      setState('finalTape')
    },
    openTape: () => {
      if (state === 'finalTape' || state === 'givingTape') setState('viewingTape')
    },
    closeTape: () => {
      if (state === 'viewingTape') setState('finalTape')
    },
    restart: () => {
      resetInput()
      setInputMode(null)
      setDialogueTrack(null)
      setDialogueIndex(0)
      setSpinEnergy(0)
      setSpinIntensity(0)
      setSpinReaction(null)
      setIsOverdrive(false)
      setCapturedPhotoUrl(null)
      setPolaroidUrl(null)
      reactionBandRef.current = 'idle'
      reactionVariantRef.current = 0
      if (overdriveTimerRef.current !== null) window.clearTimeout(overdriveTimerRef.current)
      overdriveTimerRef.current = null
      setState('idle')
    },
  }

  useEffect(() => {
    const imageUrl = input.imageUrl

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [input.imageUrl])

  useEffect(() => {
    if (state !== 'recordingIntro') return

    const timer = window.setTimeout(() => {
      setDialogueTrack(null)
      setState('needleDropping')
    }, CELEBRATION_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (state !== 'needleDropping') return

    const timer = window.setTimeout(() => setState('recording'), NEEDLE_DROP_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (state !== 'recording') return

    const timer = window.setTimeout(() => setState('returning'), RECORDING_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => () => {
    if (overdriveTimerRef.current !== null) window.clearTimeout(overdriveTimerRef.current)
  }, [])

  useEffect(() => {
    if (state !== 'returning') return

    const timer = window.setTimeout(() => {
      setDialogueTrack('photoPrompt')
      setDialogueIndex(0)
      setState('photoPrompt')
    }, RETURN_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [state])

  return {
    state,
    dialogue,
    dialogueKey,
    inputMode,
    input,
    hasInput,
    workMessage,
    spinEnergy,
    spinIntensity,
    spinReaction,
    isOverdrive,
    capturedPhotoUrl,
    polaroidUrl,
    actions,
  }
}
