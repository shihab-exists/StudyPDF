import { FILE_TTL_HOURS } from '../config';
import type { FileRecord } from '../types';

/**
 * Local file store — IndexedDB (db "studypdf", store "files").
 * Everything a user uploads or downloads stays on their device and is
 * auto-deleted after FILE_TTL_HOURS. No server storage anywhere.
 */

export interface StoredFile extends FileRecord {
  blob: Blob;
}

const DB_NAME = 'studypdf';
const STORE = 'files';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable.'));
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB operation failed.'));
      }),
  );
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function whenLabel(createdAt: number): string {
  const mins = Math.round((Date.now() - createdAt) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export async function putFile(rec: StoredFile): Promise<FileRecord> {
  await tx('readwrite', (s) => s.put(rec) as unknown as IDBRequest<unknown>);
  return meta(rec);
}

export async function saveUpload(name: string, blob: Blob, pages: number): Promise<FileRecord> {
  return putFile({
    id: newId(),
    originalName: name,
    sizeBytes: blob.size,
    pages,
    kind: 'upload',
    tool: 'upload',
    createdAt: Date.now(),
    blob,
  });
}

export async function saveResult(name: string, blob: Blob, tool: string, pages: number): Promise<FileRecord> {
  return putFile({
    id: newId(),
    originalName: name,
    sizeBytes: blob.size,
    pages,
    kind: 'result',
    tool,
    createdAt: Date.now(),
    blob,
  });
}

function meta(f: StoredFile): FileRecord {
  const { blob: _blob, ...rest } = f;
  return { ...rest, when: whenLabel(f.createdAt) };
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return tx<StoredFile | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredFile | undefined>);
}

export async function getBlob(id: string): Promise<Blob | null> {
  const f = await getFile(id);
  return f?.blob ?? null;
}

export async function listFiles(): Promise<FileRecord[]> {
  const all = await tx<StoredFile[]>('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>);
  return all
    .map(meta)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeFile(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<unknown>);
}

/** Deletes everything older than FILE_TTL_HOURS. Called on app start and after saves. */
export async function sweepExpired(): Promise<number> {
  try {
    const all = await tx<StoredFile[]>('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>);
    const cutoff = Date.now() - FILE_TTL_HOURS * 3600 * 1000;
    const dead = all.filter((f) => f.createdAt < cutoff);
    for (const f of dead) await removeFile(f.id);
    return dead.length;
  } catch {
    return 0; // storage unavailable — nothing to sweep
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

/** Triggers a browser download of a blob (object URL, revoked afterwards). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function openInTab(id: string): Promise<void> {
  const blob = await getBlob(id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Base filename without extension. */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}
