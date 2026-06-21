import { useEffect, useState } from 'react'
import type { Poi } from '../data/pois'
import { googleMapsDir } from '../data/pois'
import { listImages, type PoiImage } from '../data/poiImages'

interface Props {
  open: boolean
  pois: Poi[]
  onClose: () => void
  onFlyTo: (poi: Poi) => void
  onEdit: (poi: Poi) => void
  onDelete: (id: string) => void
}

export default function PoiPanel({ open, pois, onClose, onFlyTo, onEdit, onDelete }: Props) {
  if (!open) return null
  return (
    <div className="poi-panel-backdrop" onClick={onClose}>
      <aside className="poi-panel" onClick={(e) => e.stopPropagation()}>
        <header className="poi-panel-head">
          <h3>Saved spots ({pois.length})</h3>
          <button className="link-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </header>
        {pois.length === 0 && (
          <p className="muted block">
            No spots yet. Right-click the map → “Save point of interest”.
          </p>
        )}
        <div className="poi-list">
          {pois
            .slice()
            .sort((a, b) => b.created - a.created)
            .map((poi) => (
              <PoiCard
                key={poi.id}
                poi={poi}
                onFlyTo={onFlyTo}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
        </div>
      </aside>
    </div>
  )
}

function PoiCard({
  poi,
  onFlyTo,
  onEdit,
  onDelete,
}: {
  poi: Poi
  onFlyTo: (p: Poi) => void
  onEdit: (p: Poi) => void
  onDelete: (id: string) => void
}) {
  const [images, setImages] = useState<PoiImage[]>([])
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    let revoked: string[] = []
    listImages(poi.id).then((imgs) => {
      setImages(imgs)
      revoked = imgs.map((i) => URL.createObjectURL(i.blob))
      setUrls(revoked)
    })
    return () => revoked.forEach((u) => URL.revokeObjectURL(u))
  }, [poi.id])

  const cap = poi.capture
  return (
    <div className="poi-card">
      <div className="poi-card-head">
        <strong>{poi.name}</strong>
        <span className="poi-card-coords">
          {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
        </span>
      </div>
      {poi.notes && <p className="poi-card-notes">{poi.notes}</p>}
      {cap && (cap.geology || cap.land || cap.claim) && (
        <div className="poi-card-cap">
          {cap.geology && <span>🪨 {cap.geology}</span>}
          {cap.land && <span>🪧 {cap.land}</span>}
          {cap.claim && <span>⛏️ {cap.claim}</span>}
        </div>
      )}
      {urls.length > 0 && (
        <div className="poi-card-thumbs">
          {urls.map((u, i) => (
            <img key={i} src={u} alt={images[i]?.name ?? ''} />
          ))}
        </div>
      )}
      <div className="poi-card-actions">
        <button onClick={() => onFlyTo(poi)}>Fly to</button>
        <button onClick={() => onEdit(poi)}>Edit / photos</button>
        <a href={googleMapsDir(poi.lng, poi.lat)} target="_blank" rel="noopener">
          Navigate ↗
        </a>
        <div className="spacer" />
        <button className="link-danger" onClick={() => onDelete(poi.id)}>
          Delete
        </button>
      </div>
    </div>
  )
}
