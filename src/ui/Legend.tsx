import { DEV_STAT_COLORS } from '../layers/mrdsLayer'
import { SMA_LEGEND } from '../layers/landLayer'

export default function Legend() {
  return (
    <section className="panel-section legend">
      <h3>Legend</h3>
      <div className="legend-row">
        <span className="legend-swatch claim-active" />
        <span>Active claim</span>
      </div>
      <div className="legend-row">
        <span className="legend-swatch claim-expired" />
        <span>Expired / closed claim</span>
      </div>
      <div className="legend-row">
        <span className="legend-line-fault" />
        <span>Fault line</span>
      </div>
      <div className="legend-row">
        <span className="legend-line-contact" />
        <span>Geologic contact</span>
      </div>
      <div className="legend-sub">Geology (when on)</div>
      <div className="legend-row">
        <span className="legend-swatch" style={{ background: '#e8369b', border: '1px solid #0006' }} />
        <span>Granite/intrusion (ore contact)</span>
      </div>
      <div className="legend-note">Click any unit for its code, name, age &amp; rock type</div>
      <div className="legend-row">
        <span className="legend-grad legend-grad-mag" />
        <span>Magnetic: low → high</span>
      </div>
      <div className="legend-sub">Alteration (Sentinel-2)</div>
      <div className="legend-row">
        <span className="legend-swatch" style={{ background: '#e23b3b', border: '1px solid #0006' }} />
        <span>Iron oxide / gossan (rust)</span>
      </div>
      <div className="legend-row">
        <span className="legend-swatch" style={{ background: '#3bd23b', border: '1px solid #0006' }} />
        <span>Clay / OH alteration</span>
      </div>
      <div className="legend-sub">Land status (when on)</div>
      {SMA_LEGEND.map((s) => (
        <div className="legend-row" key={s.label}>
          <span
            className="legend-swatch"
            style={{ background: s.color, border: '1px solid #0006' }}
          />
          <span>{s.label}</span>
        </div>
      ))}
      <div className="legend-sub">MRDS site status</div>
      {Object.entries(DEV_STAT_COLORS).map(([k, c]) => (
        <div className="legend-row" key={k}>
          <span className="legend-dot" style={{ background: c }} />
          <span>{k}</span>
        </div>
      ))}
    </section>
  )
}
