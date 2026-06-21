import { MINERAL_GROUPS, ALL_MINERAL_LABELS } from '../data/commodities'

interface Props {
  selected: string[]
  onChange: (next: string[]) => void
}

export default function MineralFilter({ selected, onChange }: Props) {
  const toggle = (label: string) => {
    onChange(
      selected.includes(label) ? selected.filter((l) => l !== label) : [...selected, label],
    )
  }

  return (
    <section className="panel-section">
      <h3>Mineral filter (MRDS)</h3>
      <div className="mineral-actions">
        <button onClick={() => onChange(ALL_MINERAL_LABELS)}>All</button>
        <button onClick={() => onChange([])}>None</button>
      </div>
      <div className="mineral-grid">
        {MINERAL_GROUPS.map((g) => (
          <label className="mineral-chip" key={g.label}>
            <input
              type="checkbox"
              checked={selected.includes(g.label)}
              onChange={() => toggle(g.label)}
            />
            <span className="swatch" style={{ background: g.color }} />
            <span>{g.label}</span>
          </label>
        ))}
      </div>
    </section>
  )
}
