export type DochiFlowState =
  | 'idle'
  | 'noticed'
  | 'talking'
  | 'choosingInput'
  | 'receivingInput'
  | 'leaving'
  | 'working'
  | 'recordingIntro'
  | 'needleDropping'
  | 'recording'
  | 'returning'
  | 'photoPrompt'
  | 'cameraPreview'
  | 'photoReview'
  | 'polaroidMaking'
  | 'finalTape'
  | 'givingTape'
  | 'viewingTape'

export type InputMode = 'image' | 'text' | null

export type DochiPose = 'idle' | 'surprised' | 'thinking' | 'result'

export type PlaylistInput = {
  imageFile: File | null
  imageUrl: string | null
  pastedText: string
}

export type PhotoData = string | null

export type Track = {
  title: string
  artist: string
  mood: string
  stat: string
  color: 'coral' | 'amber' | 'violet' | 'mint'
}
