import type { CSSProperties } from 'react'

const BARS = [48, 76, 35, 92, 62, 84, 44, 70, 31, 58]

export default function Equalizer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`equalizer ${compact ? 'equalizer--compact' : ''}`} aria-hidden="true">
      {BARS.map((height, index) => {
        const style = {
          '--bar-height': `${height}%`,
          '--bar-delay': `${index * 0.08}s`,
        } as CSSProperties

        return <span className="equalizer__bar" style={style} key={`${height}-${index}`} />
      })}
    </div>
  )
}
