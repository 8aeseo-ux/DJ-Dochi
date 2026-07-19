import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseCameraResult } from '../hooks/useCamera'
import CameraCapture from './CameraCapture'

const cameraMock = vi.hoisted(() => ({
  videoRef: { current: null } as UseCameraResult['videoRef'],
  status: 'idle' as UseCameraResult['status'],
  error: null as string | null,
  startCamera: vi.fn(),
  captureFrame: vi.fn(),
  stopCamera: vi.fn(),
}))

vi.mock('../hooks/useCamera', () => ({
  useCamera: () => cameraMock,
}))

describe('CameraCapture', () => {
  beforeEach(() => {
    cameraMock.status = 'idle'
    cameraMock.error = null
    cameraMock.startCamera.mockReset()
    cameraMock.captureFrame.mockReset()
    cameraMock.stopCamera.mockReset()
    cameraMock.startCamera.mockImplementation(async () => {
      cameraMock.status = 'ready'
      return true
    })
    cameraMock.captureFrame.mockReturnValue('data:image/png;base64,user')
  })

  it('explains the camera before requesting permission and captures only on explicit click', async () => {
    const onCapture = vi.fn()
    render(<CameraCapture onCapture={onCapture} onCancel={vi.fn()} onSkip={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '도치와 사진을 남겨보세요.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카메라 켜기' })).toBeInTheDocument()
    expect(cameraMock.startCamera).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '카메라 켜기' }))
    })

    expect(cameraMock.startCamera).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '찰칵!' })).toBeInTheDocument()
    expect(onCapture).not.toHaveBeenCalled()
    expect(screen.getByLabelText('카메라 실시간 미리보기')).toHaveClass('camera-capture__video')

    fireEvent.click(screen.getByRole('button', { name: '찰칵!' }))
    expect(cameraMock.captureFrame).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('camera-capture')).toHaveClass('camera-capture')
    expect(screen.getByTestId('camera-flash')).toHaveClass('camera-capture__flash')
    expect(cameraMock.stopCamera).toHaveBeenCalledTimes(1)
    expect(onCapture).toHaveBeenCalledWith('data:image/png;base64,user')
  })

  it('shows a fallback when permission cannot be granted', async () => {
    const onSkip = vi.fn()
    cameraMock.startCamera.mockResolvedValueOnce(false)
    render(<CameraCapture onCapture={vi.fn()} onCancel={vi.fn()} onSkip={onSkip} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '카메라 켜기' }))
    })

    expect(screen.getByText('카메라를 사용할 수 없어요. 사진 없이 계속할 수 있어요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '사진 없이 계속하기' }))
    expect(cameraMock.stopCamera).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})
