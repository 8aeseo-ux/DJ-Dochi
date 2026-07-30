import { useEffect, useRef, useState } from 'react'
import { getLastVoiceCharacterIndex } from '../audio/dochiVoiceCadence'

const TYPEWRITER_DELAY_MS = 32

type DialogueBoxProps = {
  line: string
  dialogueKey: string
  onAdvance: () => void
  onCharacterReveal?: (
    character: string,
    index: number,
    metadata: { isTerminal: boolean },
  ) => void
  onTypingStop?: () => void
}

export default function DialogueBox({
  line,
  dialogueKey,
  onAdvance,
  onCharacterReveal,
  onTypingStop,
}: DialogueBoxProps) {
  const [visibleLength, setVisibleLength] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const activeDialogueKeyRef = useRef(dialogueKey)
  const reportedLengthRef = useRef(0)
  const lastVoiceCharacterIndex = getLastVoiceCharacterIndex(line)

  useEffect(() => {
    setVisibleLength(0)
    setRevealed(false)

    const timer = window.setInterval(() => {
      setVisibleLength((current) => Math.min(current + 1, line.length))
    }, TYPEWRITER_DELAY_MS)

    return () => window.clearInterval(timer)
  }, [dialogueKey, line])

  useEffect(() => {
    if (activeDialogueKeyRef.current !== dialogueKey) {
      activeDialogueKeyRef.current = dialogueKey
      reportedLengthRef.current = 0
      return
    }

    if (revealed) {
      reportedLengthRef.current = line.length
      return
    }

    for (let index = reportedLengthRef.current; index < visibleLength; index += 1) {
      onCharacterReveal?.(line[index], index, {
        isTerminal: index === lastVoiceCharacterIndex,
      })
    }
    reportedLengthRef.current = visibleLength
  }, [
    dialogueKey,
    lastVoiceCharacterIndex,
    line,
    onCharacterReveal,
    revealed,
    visibleLength,
  ])

  const isComplete = revealed || visibleLength >= line.length
  const visibleLine = revealed ? line : line.slice(0, visibleLength)

  const handleAdvance = () => {
    if (!isComplete) {
      onTypingStop?.()
      setVisibleLength(line.length)
      setRevealed(true)
      return
    }

    onTypingStop?.()
    onAdvance()
  }

  return (
    <button
      className={`dialogue-box ${isComplete ? 'dialogue-box--complete' : 'dialogue-box--typing'}`}
      type="button"
      aria-label="도치의 대화"
      aria-live="polite"
      onClick={handleAdvance}
    >
      <span className="dialogue-box__eyebrow"><span className="status-dot" /> DOCHI</span>
      <span className="dialogue-box__line">{visibleLine}</span>
      <span className="dialogue-box__next" aria-hidden="true">{isComplete ? 'NEXT ›' : 'CLICK TO REVEAL'}</span>
    </button>
  )
}
