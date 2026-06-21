import { useEffect, useRef, useState } from 'react'
import type { Poi } from '../data/pois'
import { addImages, listImages, deleteImage, type PoiImage } from '../data/poiImages'

interface Props {
  poi: Poi | null // the POI being created/edited
  isNew: boolean
  onSave: (poi: Poi) => void
  onDelete: (id: string) => void
  onCancel: () => void
}

export default function PoiForm({ poi, isNew, onSave, onDelete, onCancel }: Props) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState<PoiImage[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-init only when a different POI opens (not when its capture fills in async),
  // so it doesn't clobber what the user is typing.
  useEffect(() => {
    setName(poi?.name ?? '')
    setNotes(poi?.notes ?? '')
    if (poi) listImages(poi.id).then(setImages)
    else setImages([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poi?.id])

  // object URLs for thumbnails, revoked when the image set changes/unmounts
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const map: Record<string, string> = {}
    images.forEach((i) => (map[i.id] = URL.createObjectURL(i.blob)))
    setUrls(map)
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u))
  }, [images])

  if (!poi) return null

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    await addImages(poi.id, files)
    setImages(await listImages(poi.id))
    if (fileRef.current) fileRef.current.value = ''
  }
  const removeImage = async (id: string) => {
    await deleteImage(id)
    setImages(await listImages(poi.id))
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ ...poi, name: name.trim() || 'Unnamed spot', notes: notes.trim() })
  }

  const cap = poi.capture
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal poi-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{isNew ? 'Save point of interest' : 'Edit point of interest'}</h3>
        <div className="poi-coords">
          {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
        </div>

        <label className="field">
          <span>Name</span>
          <input value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Quartz float on contact" />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea value={notes} rows={4} onChange={(e) => setNotes(e.target.value)} placeholder="What you saw, samples taken, follow-ups, access notes…" />
        </label>

        {/* auto-captured site context */}
        <div className="capture">
          <span className="cap-title">Site context (auto)</span>
          {!cap && isNew && <div className="cap-line muted">📡 capturing geology / land / claim…</div>}
          {cap?.geology && <div className="cap-line">🪨 {cap.geology}</div>}
          {cap?.land && <div className="cap-line">🪧 {cap.land}</div>}
          {cap?.claim && <div className="cap-line">⛏️ {cap.claim}</div>}
          {cap && !cap.geology && !cap.land && !cap.claim && <div className="cap-line muted">no context found</div>}
        </div>

        {/* images */}
        <div className="field">
          <span>Photos</span>
          <div className="thumbs">
            {images.map((img) => (
              <div className="thumb" key={img.id}>
                <img src={urls[img.id]} alt={img.name} />
                <button type="button" className="thumb-x" title="Remove" onClick={() => removeImage(img.id)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="thumb-add" onClick={() => fileRef.current?.click()}>
              + Add
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
        </div>

        <div className="poi-actions">
          {!isNew && (
            <button type="button" className="btn-danger" onClick={() => onDelete(poi.id)}>
              Delete
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
