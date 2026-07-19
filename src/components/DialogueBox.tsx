import { useEffect, useState } from 'react'

const TYPEWRITER_DELAY_MS = 32

type DialogueBoxProps = {
  line: string
  dialogueKey: string
  onAdvance: () => void
}

export default function DialogueBox({ line, dialogueKey, onAdvance }: DialogueBoxProps) {
  const [visibleLength, setVisibleLength] = useState(0)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setVisibleLength(0)
    setRevealed(false)

    const timer = window.setInterval(() => {
      setVisibleLength((current) => Math.min(current + 1, line.length))
    }, TYPEWRITER_DELAY_MS)

    return () => window.clearInterval(timer)
  }, [dialogueKey, line])

  const isComplete = revealed || visibleLength >= line.length
  const visibleLine = revealed ? line : line.slice(0, visibleLength)

  const handleAdvance = () => {
    if (!isComplete) {
      setVisibleLength(line.length)
      setRevealed(true)
      return
    }

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
