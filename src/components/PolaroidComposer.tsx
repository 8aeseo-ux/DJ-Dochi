import { useEffect, useRef, useState } from 'react'
import { getDochiAsset } from '../lib/dochiAssets'
import { composePolaroid } from '../lib/polaroidComposer'

type PolaroidComposerProps = {
  userPhotoUrl: string | null
  onComplete: (polaroidUrl: string) => void
}

export default function PolaroidComposer({ userPhotoUrl, onComplete }: PolaroidComposerProps) {
  const [polaroidUrl, setPolaroidUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    let active = true
    const dochiUrl = getDochiAsset('result')

    if (!dochiUrl) {
      setError('도치 이미지를 불러오지 못했어요.')
      return () => {
        active = false
      }
    }

    setPolaroidUrl(null)
    setError(null)
    void composePolaroid({ userPhotoUrl, dochiUrl })
      .then((result) => {
        if (!active) return
        setPolaroidUrl(result)
        onCompleteRef.current(result)
      })
      .catch(() => {
        if (active) setError('기념사진을 준비하지 못했어요.')
      })

    return () => {
      active = false
    }
  }, [userPhotoUrl])

  return (
    <div className="polaroid-composer" data-testid="polaroid-composer" role="status" aria-live="polite">
      {polaroidUrl ? (
        <img className="polaroid-composer__preview" src={polaroidUrl} alt="DJ DOCHI & YOU 폴라로이드" />
      ) : error ? (
        <p className="polaroid-composer__error">{error}</p>
      ) : (
        <p className="polaroid-composer__loading">기념사진 만드는 중...</p>
      )}
    </div>
  )
}
