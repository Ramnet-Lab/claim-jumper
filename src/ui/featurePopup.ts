// HTML builders for MapLibre popups (claims + MRDS sites).

import { decodeCommodities } from '../data/commodities'
import type { GeologyUnit } from '../data/geology'

function esc(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v).replace(/[&<>"]/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  })
}

export function claimPopupHtml(p: Record<string, unknown>, kind: 'Active' | 'Expired'): string {
  const acres = typeof p.RCRD_ACRS === 'number' ? p.RCRD_ACRS.toFixed(1) : esc(p.RCRD_ACRS)
  return `
    <div class="popup">
      <div class="popup-tag ${kind === 'Active' ? 'tag-active' : 'tag-expired'}">${kind} claim</div>
      <div class="popup-title">${esc(p.CSE_NAME)}</div>
      <table class="popup-table">
        <tr><th>Serial</th><td>${esc(p.CSE_NR)}</td></tr>
        <tr><th>Case type</th><td>${esc(p.CSE_TYPE_NR)}</td></tr>
        <tr><th>Status</th><td>${esc(p.CSE_DISP)}</td></tr>
        <tr><th>Acres</th><td>${acres}</td></tr>
      </table>
    </div>`
}

export function geologyPopupHtml(u: GeologyUnit): string {
  return `
    <div class="popup">
      <div class="popup-tag tag-geo">Geologic unit${u.symbol ? ` · ${esc(u.symbol)}` : ''}</div>
      <div class="popup-title">${esc(u.name)}</div>
      <table class="popup-table">
        <tr><th>Age</th><td>${esc(u.age)}</td></tr>
        <tr><th>Rock type</th><td>${esc(u.lithology)}</td></tr>
        <tr><th>Notes</th><td>${esc(u.description)}</td></tr>
      </table>
    </div>`
}

const DES_TP: Record<string, string> = {
  WA: 'Wilderness Area',
  WSA: 'Wilderness Study Area',
  NWR: 'National Wildlife Refuge',
  NM: 'National Monument',
  NP: 'National Park',
  NRA: 'National Recreation Area',
  NCA: 'National Conservation Area',
  ACEC: 'Area of Critical Environmental Concern',
  MIL: 'Military',
  RNA: 'Research Natural Area',
  WSR: 'Wild &amp; Scenic River',
  NS: 'National Seashore',
  SW: 'State Wilderness',
}
const PUB_ACCESS: Record<string, string> = {
  OA: 'Open access',
  RA: 'Restricted (permit / seasonal)',
  XA: 'Closed to public',
  UK: 'Unknown',
}

export function restrictedPopupHtml(p: Record<string, unknown>): string {
  const des = typeof p.Des_Tp === 'string' ? DES_TP[p.Des_Tp] ?? p.Des_Tp : p.Des_Tp
  const acc = typeof p.Pub_Access === 'string' ? PUB_ACCESS[p.Pub_Access] ?? p.Pub_Access : p.Pub_Access
  return `
    <div class="popup">
      <div class="popup-tag tag-restricted">⚠ Restricted area</div>
      <div class="popup-title">${esc(p.Unit_Nm)}</div>
      <table class="popup-table">
        <tr><th>Type</th><td>${esc(des)}</td></tr>
        <tr><th>Access</th><td>${esc(acc)}</td></tr>
        <tr><th>Manager</th><td>${esc(p.Mang_Name)}</td></tr>
      </table>
      <p class="popup-note">Special designation — access, vehicles, and prospecting are often
      limited or prohibited. Verify rules with the managing agency before you go.</p>
    </div>`
}

const FAULT_TYPE: Record<string, string> = {
  N: 'Normal',
  R: 'Reverse',
  T: 'Thrust',
  SS: 'Strike-slip',
  SR: 'Strike-slip (right)',
  SL: 'Strike-slip (left)',
}

export function contactPopupHtml(p: Record<string, unknown>): string {
  return `
    <div class="popup">
      <div class="popup-tag tag-geo">Geologic contact</div>
      <div class="popup-title">${esc(p.contactType) === '—' ? 'Formation boundary' : esc(p.contactType)}</div>
      <p class="popup-note">Boundary between rock units — veins &amp; ore shoots often follow
      contacts and the faults that cut them.</p>
    </div>`
}

export function faultPopupHtml(p: Record<string, unknown>): string {
  const t = typeof p.Type === 'string' ? FAULT_TYPE[p.Type.trim()] ?? p.Type : p.Type
  return `
    <div class="popup">
      <div class="popup-tag tag-fault">Fault</div>
      <div class="popup-title">${esc(p.Name)}</div>
      <table class="popup-table">
        <tr><th>Age</th><td>${esc(p.Age)} yr</td></tr>
        <tr><th>Type</th><td>${esc(t)}</td></tr>
        <tr><th>Slip rate</th><td>${esc(p.SlipRate)}</td></tr>
        <tr><th>Source</th><td>${esc(p.Source)}</td></tr>
      </table>
    </div>`
}

export function mrdsPopupHtml(p: Record<string, unknown>): string {
  const url = typeof p.URL === 'string' && p.URL ? p.URL : null
  const reportLink = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener">Open USGS report ↗</a>`
    : '—'
  return `
    <div class="popup">
      <div class="popup-tag tag-mrds">MRDS site</div>
      <div class="popup-title">${esc(p.SITE_NAME)}</div>
      <table class="popup-table">
        <tr><th>Status</th><td>${esc(p.DEV_STAT)}</td></tr>
        <tr><th>Minerals</th><td>${esc(decodeCommodities(p.CODE_LIST as string))}</td></tr>
        <tr><th>Codes</th><td>${esc(p.CODE_LIST)}</td></tr>
        <tr><th>Report</th><td>${reportLink}</td></tr>
      </table>
    </div>`
}
