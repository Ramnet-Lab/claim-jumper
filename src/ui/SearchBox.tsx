import { useState } from 'react'

interface Props {
  onSearch: (query: string) => Promise<boolean>
}

export default function SearchBox({ onSearch }: Props) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [miss, setMiss] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true)
    setMiss(false)
    const ok = await onSearch(q.trim())
    setBusy(false)
    if (!ok) setMiss(true)
  }

  return (
    <form className="searchbox" onSubmit={submit}>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setMiss(false)
        }}
        placeholder="Find a place (e.g. Round Mountain, NV)"
        aria-label="Search location"
      />
      <button type="submit" disabled={busy}>
        {busy ? '…' : 'Go'}
      </button>
      {miss && <span className="search-miss">no match</span>}
    </form>
  )
}
