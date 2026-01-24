/**
 * Recent traces storage using IndexedDB
 */

import { hashContent } from './hash';

const DB_NAME = 'thinking-tracer';
const DB_VERSION = 1;
const STORE_NAME = 'recent-traces';
const MAX_RECENT = 10;

/** Persisted UI state for a trace */
export interface TraceUIState {
  /** Camera position [x, y, z] */
  cameraPosition?: [number, number, number];
  /** Camera target/look-at point [x, y, z] */
  cameraTarget?: [number, number, number];
  /** View mode */
  viewMode?: '3d' | 'split' | 'conversation';
  /** Sidebar visibility */
  sidebarVisible?: boolean;
  /** Split pane ratio (0-1) */
  splitRatio?: number;
  /** Selected cluster index */
  selectedCluster?: number;
}

export interface RecentTrace {
  /** Unique ID (hash of content) */
  id: string;
  /** Original filename */
  filename: string;
  /** Title from parsed conversation */
  title: string;
  /** Custom user-defined name (overrides title if set) */
  customName?: string;
  /** When it was last opened */
  lastOpened: number;
  /** Number of turns */
  turnCount: number;
  /** File content for reload */
  content: string;
  /** File size in bytes */
  size: number;
  /** Persisted UI state */
  uiState?: TraceUIState;
}

/**
 * Open the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastOpened', 'lastOpened', { unique: false });
      }
    };
  });
}

/**
 * Save a trace to recent history
 */
export async function saveRecentTrace(
  filename: string,
  title: string,
  turnCount: number,
  content: string
): Promise<void> {
  const db = await openDB();

  const trace: RecentTrace = {
    id: await hashContent(content),
    filename,
    title,
    lastOpened: Date.now(),
    turnCount,
    content,
    size: new Blob([content]).size,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Add or update the trace
    const putRequest = store.put(trace);

    putRequest.onsuccess = () => {
      // Enforce max recent limit
      enforceLimit(store).then(resolve).catch(reject);
    };

    putRequest.onerror = () => reject(putRequest.error);
  });
}

/**
 * Enforce the maximum number of recent traces
 */
async function enforceLimit(store: IDBObjectStore): Promise<void> {
  return new Promise((resolve, reject) => {
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;

      if (count <= MAX_RECENT) {
        resolve();
        return;
      }

      // Get oldest entries and delete them
      const index = store.index('lastOpened');
      const toDelete = count - MAX_RECENT;
      let deleted = 0;

      const cursorRequest = index.openCursor();

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && deleted < toDelete) {
          store.delete(cursor.primaryKey);
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    };

    countRequest.onerror = () => reject(countRequest.error);
  });
}

/**
 * Get all recent traces, sorted by last opened (most recent first)
 */
export async function getRecentTraces(): Promise<RecentTrace[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('lastOpened');

    const traces: RecentTrace[] = [];
    const cursorRequest = index.openCursor(null, 'prev'); // Descending order

    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        traces.push(cursor.value);
        cursor.continue();
      } else {
        resolve(traces);
      }
    };

    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

/**
 * Get a specific trace by ID
 */
export async function getTraceById(id: string): Promise<RecentTrace | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update the custom name for a trace
 */
export async function updateTraceCustomName(id: string, customName: string): Promise<void> {
  const db = await openDB();
  const trace = await getTraceById(id);

  if (!trace) {
    throw new Error('Trace not found');
  }

  // Update the custom name (empty string clears it)
  trace.customName = customName.trim() || undefined;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(trace);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update the UI state for a trace
 */
export async function updateTraceUIState(id: string, uiState: TraceUIState): Promise<void> {
  const db = await openDB();
  const trace = await getTraceById(id);

  if (!trace) {
    // Trace not found - silently ignore (might have been cleared)
    return;
  }

  // Merge with existing state
  trace.uiState = { ...trace.uiState, ...uiState };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(trace);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a trace from history
 */
export async function deleteRecentTrace(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all recent traces
 */
export async function clearRecentTraces(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Format file size for display
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
