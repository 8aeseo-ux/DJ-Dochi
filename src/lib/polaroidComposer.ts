export type ComposePolaroidOptions = {
  userPhotoUrl: string | null
  dochiUrl: string
}

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 1_080

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Image failed to load: ${url}`))
    image.src = url
  })
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width?: number; height?: number },
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = image.width || width
  const sourceHeight = image.height || height
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = width / height

  let cropWidth = sourceWidth
  let cropHeight = sourceHeight
  let cropX = 0
  let cropY = 0

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio
    cropX = (sourceWidth - cropWidth) / 2
  } else {
    cropHeight = sourceWidth / targetRatio
    cropY = (sourceHeight - cropHeight) / 2
  }

  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, x, y, width, height)
}

function drawTape(context: CanvasRenderingContext2D, x: number, y: number, width: number, rotation: number) {
  context.save()
  context.translate(x, y)
  context.rotate(rotation)
  context.fillStyle = 'rgba(244, 186, 119, 0.78)'
  context.beginPath()
  context.moveTo(0, 0)
  context.lineTo(width, 6)
  context.lineTo(width - 10, 54)
  context.lineTo(8, 48)
  context.closePath()
  context.fill()
  context.restore()
}

function drawPaper(context: CanvasRenderingContext2D) {
  context.fillStyle = '#f4edda'
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.strokeStyle = '#2a2220'
  context.lineWidth = 7
  context.strokeRect(24, 24, CANVAS_WIDTH - 48, CANVAS_HEIGHT - 48)

  context.strokeStyle = 'rgba(42, 34, 32, 0.34)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(38, 43)
  context.lineTo(862, 50)
  context.lineTo(850, 1_045)
  context.lineTo(48, 1_038)
  context.closePath()
  context.stroke()
}

export async function composePolaroid({ userPhotoUrl, dochiUrl }: ComposePolaroidOptions): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')

  const dochiImage = await loadImage(dochiUrl)
  const userImage = userPhotoUrl ? await loadImage(userPhotoUrl) : null

  drawPaper(context)

  context.fillStyle = '#211a1d'
  context.fillRect(62, 84, 776, 720)
  if (userImage) {
    drawCoverImage(context, userImage, 78, 100, 744, 688)
  } else {
    context.fillStyle = '#ded3be'
    context.fillRect(78, 100, 744, 688)
    context.fillStyle = '#76625e'
    context.font = '700 28px monospace'
    context.textAlign = 'center'
    context.fillText('NO CAMERA PHOTO', CANVAS_WIDTH / 2, 430)
  }

  context.save()
  context.translate(595, 566)
  context.rotate(-0.08)
  drawCoverImage(context, dochiImage, 0, 0, 265, 285)
  context.restore()

  drawTape(context, 107, 74, 175, -0.04)
  drawTape(context, 668, 790, 170, 0.06)

  context.fillStyle = '#2a2220'
  context.font = '800 42px monospace'
  context.textAlign = 'center'
  context.fillText('DJ DOCHI & YOU', CANVAS_WIDTH / 2, 900)
  context.font = '600 20px monospace'
  context.fillText('A MEMORY FROM ROOM 01', CANVAS_WIDTH / 2, 945)

  context.strokeStyle = '#eb6d61'
  context.lineWidth = 5
  context.strokeRect(50, 70, 800, 865)

  return canvas.toDataURL('image/png')
}
