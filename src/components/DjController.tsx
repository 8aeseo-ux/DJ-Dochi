import controllerAsset from '../assets/workshop/dj-controller.webp'

export default function DjController() {
  return (
    <div className="room-controller" data-testid="dj-controller" role="img" aria-label="DJ 컨트롤러">
      <img className="room-controller__asset" src={controllerAsset} alt="" draggable={false} />
    </div>
  )
}
