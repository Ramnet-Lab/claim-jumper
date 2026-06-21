// MRDS commodity codes -> friendly mineral names, grouped for the filter UI.
// The compact MRDS layer stores commodities in CODE_LIST as a space/comma-delimited
// list of short codes (e.g. "AU AG CU"). We match by substring so the exact delimiter
// doesn't matter.

export interface MineralGroup {
  /** UI label, e.g. "Gold". */
  label: string
  /** Codes that count as this group (matched as substrings of CODE_LIST). */
  codes: string[]
  /** Hex color for the legend swatch / point styling accent. */
  color: string
}

// Codes drawn from USGS MRDS commodity abbreviations. Grouped around what a Nevada
// prospector actually hunts. Substring matching keeps it forgiving.
export const MINERAL_GROUPS: MineralGroup[] = [
  { label: 'Gold', codes: ['AU'], color: '#f4c430' },
  { label: 'Silver', codes: ['AG'], color: '#c0c0c0' },
  { label: 'Copper', codes: ['CU'], color: '#b87333' },
  { label: 'Lead / Zinc', codes: ['PB', 'ZN'], color: '#6e7b8b' },
  { label: 'Mercury', codes: ['HG'], color: '#9a8fb5' },
  { label: 'Tungsten', codes: ['W'], color: '#4d5d53' },
  { label: 'Lithium', codes: ['LI'], color: '#e75480' },
  { label: 'Opal', codes: ['OPAL', 'OPL'], color: '#a3e7f0' },
  { label: 'Turquoise', codes: ['TURQ', 'TQ'], color: '#40e0d0' },
  {
    label: 'Quartz / Gemstone',
    codes: ['GEM', 'QZ', 'QTZ', 'AGATE', 'JASP', 'GAR', 'BERYL'],
    color: '#dda0dd',
  },
  { label: 'Barite / Industrial', codes: ['BA', 'FLR', 'GYP', 'CLAY', 'PERL'], color: '#8fbc8f' },
]

/** All group labels, for default-selected filter state. */
export const ALL_MINERAL_LABELS = MINERAL_GROUPS.map((g) => g.label)

/**
 * Build an ArcGIS where-clause matching any of the selected mineral groups.
 * Returns '1=1' when all (or none meaningfully) are selected.
 */
export function mineralWhereClause(selected: string[]): string {
  if (selected.length === 0) return '1=0' // nothing selected -> show nothing
  if (selected.length >= MINERAL_GROUPS.length) return '1=1'

  const clauses: string[] = []
  for (const group of MINERAL_GROUPS) {
    if (!selected.includes(group.label)) continue
    for (const code of group.codes) {
      // Case-insensitive-ish LIKE; CODE_LIST is uppercase in MRDS.
      clauses.push(`CODE_LIST LIKE '%${code}%'`)
    }
  }
  return clauses.length ? `(${clauses.join(' OR ')})` : '1=1'
}

/** Decode a raw CODE_LIST string into friendly group labels for popups. */
export function decodeCommodities(codeList: string | null | undefined): string {
  if (!codeList) return 'Unknown'
  const upper = codeList.toUpperCase()
  const hits = MINERAL_GROUPS.filter((g) => g.codes.some((c) => upper.includes(c))).map(
    (g) => g.label,
  )
  return hits.length ? hits.join(', ') : codeList
}
