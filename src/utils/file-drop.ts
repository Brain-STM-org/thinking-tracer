/**
 * File drag-and-drop utilities
 */

import { decompress as decompressZstd } from 'fzstd';

// File System Access API types (for browsers that support it)
interface FSAFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

interface FSAPickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

/**
 * File watcher using File System Access API
 * Polls for changes and calls callback when file is modified
 */
export class FileWatcher {
  private handle: FSAFileHandle | null = null;
  private lastModified: number = 0;
  private lastSize: number = 0;
  private intervalId: number | null = null;
  private pollInterval: number;
  private onChange: (content: string, filename: string) => void;
  private onError?: (error: Error) => void;

  constructor(options: {
    onChange: (content: string, filename: string) => void;
    onError?: (error: Error) => void;
    pollInterval?: number;
  }) {
    this.onChange = options.onChange;
    this.onError = options.onError;
    this.pollInterval = options.pollInterval ?? 1000;
  }

  /**
   * Check if File System Access API is supported
   */
  static isSupported(): boolean {
    return 'showOpenFilePicker' in window;
  }

  /**
   * Open file picker and start watching the selected file
   */
  async openAndWatch(): Promise<{ content: string; filename: string } | null> {
    if (!FileWatcher.isSupported()) {
      this.onError?.(new Error('File System Access API not supported in this browser'));
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const showOpenFilePicker = (window as any).showOpenFilePicker as (options?: FSAPickerOptions) => Promise<FSAFileHandle[]>;
      const [handle] = await showOpenFilePicker({
        types: [
          {
            description: 'Conversation traces',
            accept: {
              'application/json': ['.json', '.jsonl'],
              'application/gzip': ['.gz'],
              'application/zstd': ['.zst', '.zstd'],
            },
          },
        ],
      });

      this.handle = handle;
      const file = await handle.getFile();
      this.lastModified = file.lastModified;
      this.lastSize = file.size;

      const content = await readFileContentFromFile(file);

      // Start polling for changes
      this.startPolling();

      return { content, filename: getDisplayName(file.name) };
    } catch (err) {
      // User cancelled picker
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }

  /**
   * Start polling for file changes
   */
  private startPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = window.setInterval(async () => {
      if (!this.handle) return;

      try {
        const file = await this.handle.getFile();

        // Check if file was modified (by time or size)
        if (file.lastModified !== this.lastModified || file.size !== this.lastSize) {
          this.lastModified = file.lastModified;
          this.lastSize = file.size;

          const content = await readFileContentFromFile(file);
          this.onChange(content, getDisplayName(file.name));
        }
      } catch (err) {
        // File might have been deleted or permission revoked
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
        this.stop();
      }
    }, this.pollInterval);
  }

  /**
   * Stop watching the file
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.handle = null;
  }

  /**
   * Check if currently watching a file
   */
  isWatching(): boolean {
    return this.handle !== null && this.intervalId !== null;
  }

  /**
   * Get the current file name being watched
   */
  getFileName(): string | null {
    return this.handle?.name ?? null;
  }
}

/**
 * Read file content, decompressing if needed (standalone function)
 */
async function readFileContentFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.gz')) {
    const ds = new DecompressionStream('gzip');
    const stream = file.stream().pipeThrough(ds);
    return await new Response(stream).text();
  }

  if (name.endsWith('.zst') || name.endsWith('.zstd')) {
    const buffer = await file.arrayBuffer();
    const decompressed = decompressZstd(new Uint8Array(buffer));
    return new TextDecoder().decode(decompressed);
  }

  return await file.text();
}

/**
 * Get display name by stripping compression extensions
 */
function getDisplayName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.gz')) return name.slice(0, -3);
  if (lower.endsWith('.zstd')) return name.slice(0, -5);
  if (lower.endsWith('.zst')) return name.slice(0, -4);
  return name;
}

export interface FileDropOptions {
  /** Element to attach drop listeners to */
  target: HTMLElement;
  /** Overlay element to show during drag */
  overlay?: HTMLElement;
  /** Callback when file is dropped */
  onDrop: (content: string, filename: string) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Accepted file extensions (e.g., ['.json']) */
  accept?: string[];
}

/**
 * Decompress a gzipped file using native browser API
 */
export async function decompressGzip(file: File): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const stream = file.stream().pipeThrough(ds);
  return await new Response(stream).text();
}

/**
 * Decompress a zstd file using fzstd library
 */
export async function decompressZstdFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return decompressZstdBuffer(buffer);
}

/**
 * Decompress zstd data from an ArrayBuffer
 */
export function decompressZstdBuffer(buffer: ArrayBuffer): string {
  const decompressed = decompressZstd(new Uint8Array(buffer));
  return new TextDecoder().decode(decompressed);
}

/**
 * Read file content, decompressing if needed
 */
async function readFileContent(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.gz')) {
    return await decompressGzip(file);
  }

  if (name.endsWith('.zst') || name.endsWith('.zstd')) {
    return await decompressZstdFile(file);
  }

  // Plain text
  return await file.text();
}

/**
 * Initialize file drop handling on an element
 */
export function initFileDrop(options: FileDropOptions): () => void {
  const { target, overlay, onDrop, onError, accept = ['.json'] } = options;

  let dragCounter = 0;

  function showOverlay() {
    if (overlay) {
      overlay.classList.add('active');
    }
  }

  function hideOverlay() {
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    showOverlay();
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      hideOverlay();
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    hideOverlay();

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    const name = file.name.toLowerCase();

    // Check extension, handling compressed variants (.jsonl.gz, .jsonl.zst)
    const isGzipped = name.endsWith('.gz');

    let baseName = name;
    if (isGzipped) baseName = name.slice(0, -3);
    else if (name.endsWith('.zstd')) baseName = name.slice(0, -5);
    else if (name.endsWith('.zst')) baseName = name.slice(0, -4);

    const extension = '.' + baseName.split('.').pop();

    if (!accept.includes(extension)) {
      onError?.(new Error(`Unsupported file type: ${extension}. Expected: ${accept.join(', ')}`));
      return;
    }

    try {
      const content = await readFileContent(file);
      // Use original filename but strip compression extension for display
      let displayName = file.name;
      if (isGzipped) displayName = file.name.slice(0, -3);
      else if (file.name.toLowerCase().endsWith('.zstd')) displayName = file.name.slice(0, -5);
      else if (file.name.toLowerCase().endsWith('.zst')) displayName = file.name.slice(0, -4);
      onDrop(content, displayName);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // Attach event listeners
  target.addEventListener('dragenter', handleDragEnter);
  target.addEventListener('dragleave', handleDragLeave);
  target.addEventListener('dragover', handleDragOver);
  target.addEventListener('drop', handleDrop);

  // Return cleanup function
  return () => {
    target.removeEventListener('dragenter', handleDragEnter);
    target.removeEventListener('dragleave', handleDragLeave);
    target.removeEventListener('dragover', handleDragOver);
    target.removeEventListener('drop', handleDrop);
  };
}
