import type { DochiPose } from '../types'

const dochiFiles = import.meta.glob('../assets/dochi/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

export const DOCHI_IDLE_ASSET_FILENAMES = [
  'dochi-idle-01.webp',
  'dochi-idle-02.webp',
] as const

export const DOCHI_ASSET_FILENAMES: Record<DochiPose, string> = {
  idle: 'dochi-idle.webp',
  surprised: 'dochi-noticed.webp',
  thinking: 'dochi-thinking.webp',
  result: 'dochi-result.webp',
}

function getDochiAssetByFilename(filename: string): string | undefined {
  const matchingPath = Object.keys(dochiFiles).find((path) => path.endsWith(filename))
  return matchingPath ? dochiFiles[matchingPath] : undefined
}

export function getDochiAsset(pose: DochiPose): string | undefined {
  return getDochiAssetByFilename(DOCHI_ASSET_FILENAMES[pose])
}

export function getDochiIdleAsset(frame: number): string | undefined {
  const filename = DOCHI_IDLE_ASSET_FILENAMES[frame % DOCHI_IDLE_ASSET_FILENAMES.length]
  return getDochiAssetByFilename(filename)
}
