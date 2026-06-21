import type { SavedExpedition } from '../data/expedition'
import { trackMeters, formatMiles, formatDuration } from '../data/expedition'

interface Props {
  open: boolean
  expeditions: SavedExpedition[]
  viewedId: string | null
  onClose: () => void
  onShow: (exp: SavedExpedition) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export default function ExpeditionPanel({
  open,
  expeditions,
  viewedId,
  onClose,
  onShow,
  onRename,
  onDelete,
}: Props) {
  if (!open) return null
  return (
    <div className="poi-panel-backdrop" onClick={onClose}>
      <aside className="poi-panel" onClick={(e) => e.stopPropagation()}>
        <header className="poi-panel-head">
          <h3>Expeditions ({expeditions.length})</h3>
          <button className="link-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </header>
        {expeditions.length === 0 && (
          <p className="muted block">
            No saved expeditions yet. Tap ▶ Expedition to record a GPS trace — it's saved here
            automatically when you stop.
          </p>
        )}
        <div className="poi-list">
          {expeditions
            .slice()
            .sort((a, b) => b.startedAt - a.startedAt)
            .map((exp) => {
              const dist = formatMiles(trackMeters(exp.points))
              const dur = formatDuration(exp.endedAt - exp.startedAt)
              return (
                <div className={`poi-card ${viewedId === exp.id ? 'exp-card-active' : ''}`} key={exp.id}>
                  <input
                    className="exp-name"
                    defaultValue={exp.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== exp.name) onRename(exp.id, v)
                    }}
                  />
                  <div className="poi-card-cap">
                    <span>{new Date(exp.startedAt).toLocaleString()}</span>
                    <span>
                      {dist} · {dur} · {exp.points.length} points
                    </span>
                  </div>
                  <div className="poi-card-actions">
                    <button onClick={() => onShow(exp)}>
                      {viewedId === exp.id ? 'Showing ✓' : 'Show on map'}
                    </button>
                    <div className="spacer" />
                    <button className="link-danger" onClick={() => onDelete(exp.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      </aside>
    </div>
  )
}
