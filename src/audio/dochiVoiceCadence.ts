import { DOCHI_VOICE_CONFIG } from './dochiVoiceConfig'

function hashString(value: string): number {
  let hash = 2_166_136_261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}

function getCadenceGap(dialogueKey: string, voiceIndex: number): number {
  const { minCharacters, maxCharacters } = DOCHI_VOICE_CONFIG.cadence
  const range = maxCharacters - minCharacters + 1
  return minCharacters + (hashString(`${dialogueKey}:${voiceIndex}`) % range)
}

export function isVoiceCharacter(character: string): boolean {
  return /[\p{L}\p{N}]/u.test(character)
}

export function getLastVoiceCharacterIndex(line: string): number {
  for (let index = line.length - 1; index >= 0; index -= 1) {
    if (isVoiceCharacter(line[index])) return index
  }

  return -1
}

type VoiceCharacterMetadata = {
  isTerminal?: boolean
}

export class DochiVoiceCadence {
  private dialogueKey = ''
  private remainingCharacters = 0
  private voiceIndex = 0
  private lastProcessedIndex = -1

  reset(dialogueKey: string) {
    this.dialogueKey = dialogueKey
    this.remainingCharacters = DOCHI_VOICE_CONFIG.cadence.minCharacters
    this.voiceIndex = 0
    this.lastProcessedIndex = -1
  }

  shouldPlay(
    dialogueKey: string,
    character: string,
    characterIndex: number,
    metadata: VoiceCharacterMetadata = {},
  ): boolean {
    if (this.dialogueKey !== dialogueKey) this.reset(dialogueKey)
    if (characterIndex <= this.lastProcessedIndex) return false

    this.lastProcessedIndex = characterIndex
    if (!isVoiceCharacter(character)) return false

    if (metadata.isTerminal) {
      this.voiceIndex += 1
      this.remainingCharacters = getCadenceGap(dialogueKey, this.voiceIndex)
      return true
    }

    this.remainingCharacters -= 1
    if (this.remainingCharacters > 0) return false

    this.voiceIndex += 1
    this.remainingCharacters = getCadenceGap(dialogueKey, this.voiceIndex)
    return true
  }
}
