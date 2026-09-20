import type { CrosswordPuzzleData } from './types';

export interface OfflinePuzzleCache {
  puzzle: CrosswordPuzzleData & { magicWords?: string[] };
  language: 'fr' | 'en';
}

export interface OfflinePuzzleDraft {
  key: string;
  ownerKey: string;
  puzzleId: string;
  userInputs: (string | null)[][];
  timeSpent: number;
  revealedCells: string[];
  updatedAt: number;
  needsSync: boolean;
  puzzle?: OfflinePuzzleCache;
}

const DATABASE_NAME = 'wordfusion-offline';
const DATABASE_VERSION = 1;
const STORE_NAME = 'puzzle-drafts';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('ownerKey', 'ownerKey', { unique: false });
        store.createIndex('needsSync', 'needsSync', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
  });
}

function runRequest<T>(request: IDBRequest<T>, database: IDBDatabase): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    request.transaction?.addEventListener('complete', () => database.close(), { once: true });
  });
}

export async function getOfflineDraft(key: string): Promise<OfflinePuzzleDraft | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  return runRequest(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key), database) as Promise<OfflinePuzzleDraft | null>;
}

export async function saveOfflineDraft(draft: OfflinePuzzleDraft): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  const store = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  const existing = await new Promise<OfflinePuzzleDraft | undefined>((resolve, reject) => {
    const request = store.get(draft.key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
  await runRequest(store.put({ ...existing, ...draft, puzzle: draft.puzzle ?? existing?.puzzle }), database);
}

export async function deleteOfflineDraft(key: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await runRequest(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key), database);
}

export async function markOfflineDraftSynced(key: string, updatedAt: number): Promise<void> {
  const draft = await getOfflineDraft(key);
  if (!draft || draft.updatedAt > updatedAt) return;
  await saveOfflineDraft({ ...draft, needsSync: false });
}

export async function getPendingOfflineDrafts(ownerKey: string): Promise<OfflinePuzzleDraft[]> {
  if (typeof indexedDB === 'undefined') return [];
  const database = await openDatabase();
  const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('ownerKey').getAll(ownerKey);
  const drafts = await runRequest(request, database) as OfflinePuzzleDraft[];
  return drafts.filter((draft) => draft.needsSync);
}
