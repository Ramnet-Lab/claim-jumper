import { useEffect, useState } from 'react'
import type { Expedition } from '../data/expedition'
import { trackMeters, formatMiles, formatDuration } from '../data/expedition'

interface Props {
  expedition: Expedition
  savedCount: number
  onStart: () => void
  onStop: () => void
  onOpenList: () => void
}

export default function ExpeditionButton({
  expedition,
  savedCount,
  onStart,
  onStop,
  onOpenList,
}: Props) {
  const { active, startedAt, points } = expedition

  // tick once a second to update the live duration while recording
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [active])

  if (active) {
    const dist = formatMiles(trackMeters(points))
    const dur = startedAt ? formatDuration(Date.now() - startedAt) : '0:00'
    return (
      <button className="exp-btn exp-recording" onClick={onStop} title="Stop &amp; save expedition">
        <span className="exp-rec-dot" /> Stop · {dur} · {dist}
      </button>
    )
  }

  return (
    <span className="exp-wrap">
      <button className="exp-btn" onClick={onStart} title="Start expedition (records a GPS trace)">
        ▶<span className="hide-narrow"> Expedition</span>
      </button>
      <button className="exp-list-btn" onClick={onOpenList} title="Saved expeditions">
        🗂 {savedCount > 0 && <span className="spots-count">{savedCount}</span>}
      </button>
    </span>
  )
}
