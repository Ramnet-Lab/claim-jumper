import { useEffect, useState } from 'react'
import { googleMapsDir } from '../data/pois'
import { captureSite, type SiteCapture } from '../data/captureSite'

export interface MenuState {
  x: number
  y: number
  lng: number
  lat: number
}

interface Props {
  menu: MenuState | null
  onClose: () => void
  onSavePoi: () => void
  onComputeWetness: () => void
  onComputeAlteration: () => void
}

export default function ContextMenu({
  menu,
  onClose,
  onSavePoi,
  onComputeWetness,
  onComputeAlteration,
}: Props) {
  useEffect(() => {
    if (!menu) return
    const onClick = () => onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, onClose])

  // Auto-look-up land owner / claim / rock at the clicked point.
  const [cap, setCap] = useState<SiteCapture | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!menu) {
      setCap(null)
      return
    }
    let cancelled = false
    setCap(null)
    setLoading(true)
    captureSite(menu.lng, menu.lat).then((c) => {
      if (!cancelled) {
        setCap(c)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [menu])

  if (!menu) return null

  // keep the menu on-screen
  const style: React.CSSProperties = {
    left: Math.min(menu.x, window.innerWidth - 240),
    top: Math.min(menu.y, window.innerHeight - 300),
  }
  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
    onClose()
  }

  return (
    <div className="ctx-menu" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="ctx-coords">
        {menu.lat.toFixed(5)}, {menu.lng.toFixed(5)}
      </div>
      <div className="ctx-readout">
        {loading && <div className="ctx-read-line muted">checking land / claim / rock…</div>}
        {cap?.land && <div className="ctx-read-line">🪧 {cap.land}</div>}
        {cap?.claim && (
          <div className={`ctx-read-line ${/On active claim/.test(cap.claim) ? 'claim-hit' : 'claim-open'}`}>
            ⛏️ {cap.claim}
          </div>
        )}
        {cap?.geology && <div className="ctx-read-line">🪨 {cap.geology}</div>}
      </div>
      <button className="ctx-item" onClick={run(onSavePoi)}>
        📍 Save point of interest…
      </button>
      <button className="ctx-item" onClick={run(onComputeWetness)}>
        💧 Compute wetness here
      </button>
      <button className="ctx-item" onClick={run(onComputeAlteration)}>
        🛰️ Compute alteration here
      </button>
      <a
        className="ctx-item"
        href={googleMapsDir(menu.lng, menu.lat)}
        target="_blank"
        rel="noopener"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        🧭 Navigate (Google Maps) ↗
      </a>
    </div>
  )
}
