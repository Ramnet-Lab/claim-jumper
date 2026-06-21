// Image storage for POIs, backed by IndexedDB (handles large blobs that would blow
// localStorage's ~5 MB limit). Images are keyed by id and indexed by poiId.

export interface PoiImage {
  id: string
  poiId: string
  name: string
  type: string
  blob: Blob
}

const DB_NAME = 'claim-jumper'
const STORE = 'images'
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('poiId', 'poiId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function imgId(): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${performance.now()}`
  return `img_${rand}`
}

export async function addImages(poiId: string, files: File[]): Promise<void> {
  const db = await openDb()
  await Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite')
          tx.objectStore(STORE).put({
            id: imgId(),
            poiId,
            name: file.name,
            type: file.type,
            blob: file,
          } satisfies PoiImage)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }),
    ),
  )
  db.close()
}

export async function listImages(poiId: string): Promise<PoiImage[]> {
  const db = await openDb()
  const out = await new Promise<PoiImage[]>((resolve, reject) => {
    const idx = db.transaction(STORE, 'readonly').objectStore(STORE).index('poiId')
    const req = idx.getAll(poiId)
    req.onsuccess = () => resolve(req.result as PoiImage[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return out
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function deleteImagesForPoi(poiId: string): Promise<void> {
  const imgs = await listImages(poiId)
  await Promise.all(imgs.map((i) => deleteImage(i.id)))
}

export async function countImages(poiId: string): Promise<number> {
  return (await listImages(poiId)).length
}
