import { useEffect, useState } from 'react'
import type { Expedition } from '../data/expedition'
import { trackMeters, formatMiles, formatDuration } from '../data/expedition'

interface Props {
  expedition: Expedition
  onStart: () => void
  onStop: () => void
  onClear: () => void
}

export default function ExpeditionButton({ expedition, onStart, onStop, onClear }: Props) {
  const { active, startedAt, points } = expedition

  // tick once a second to update the live duration while recording
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [active])

  const dist = formatMiles(trackMeters(points))
  const dur = startedAt ? formatDuration(Date.now() - startedAt) : '0:00'

  if (active) {
    return (
      <button className="exp-btn exp-recording" onClick={onStop} title="Stop expedition">
        <span className="exp-rec-dot" /> Stop · {dur} · {dist}
      </button>
    )
  }

  // inactive: start a new one; if a finished trace exists, show its length + a clear
  return (
    <span className="exp-wrap">
      <button className="exp-btn" onClick={onStart} title="Start expedition (records a GPS trace)">
        ▶ Expedition
      </button>
      {points.length > 0 && (
        <button className="exp-clear" onClick={onClear} title={`Clear trace (${dist})`}>
          {dist} ✕
        </button>
      )}
    </span>
  )
}
