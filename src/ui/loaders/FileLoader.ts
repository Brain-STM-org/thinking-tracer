/**
 * FileLoader - handles file loading, compression, and file watching
 */

import {
  initFileDrop,
  decompressGzip,
  decompressZstdFile,
  decompressZstdBuffer,
  FileWatcher,
} from '../../utils/file-drop';

/**
 * Callback for when a file is loaded
 */
export type FileLoadCallback = (content: string, filename: string, skipSave?: boolean, customName?: string) => Promise<void>;

/**
 * Options for FileLoader
 */
export interface FileLoaderOptions {
  /** File input element */
  fileInput: HTMLInputElement | null;
  /** File select button */
  fileSelectBtn: HTMLElement | null;
  /** Try sample button */
  trySampleBtn: HTMLElement | null;
  /** Watch toggle button */
  watchToggle: HTMLElement | null;
  /** Drop overlay element */
  dropOverlay: HTMLElement | null;
  /** Callback when file is loaded */
  onLoad: FileLoadCallback;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * FileLoader manages all file loading operations
 */
export class FileLoader {
  private fileInput: HTMLInputElement | null;
  private fileSelectBtn: HTMLElement | null;
  private trySampleBtn: HTMLElement | null;
  private watchToggle: HTMLElement | null;
  private dropOverlay: HTMLElement | null;
  private onLoad: FileLoadCallback;
  private onError: (error: Error) => void;
  private fileWatcher: FileWatcher | null = null;
  private disposed = false;

  // Bound event handlers for cleanup
  private boundHandleFileSelectClick: () => void;
  private boundHandleFileInputChange: () => void;
  private boundHandleWatchClick: () => void;
  private boundHandleTrySampleClick: () => void;

  // Active timeouts for cleanup
  private notificationTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: FileLoaderOptions) {
    this.fileInput = options.fileInput;
    this.fileSelectBtn = options.fileSelectBtn;
    this.trySampleBtn = options.trySampleBtn;
    this.watchToggle = options.watchToggle;
    this.dropOverlay = options.dropOverlay;
    this.onLoad = options.onLoad;
    this.onError = options.onError || ((err) => console.error(err));

    // Bind handlers
    this.boundHandleFileSelectClick = this.handleFileSelectClick.bind(this);
    this.boundHandleFileInputChange = this.handleFileInputChange.bind(this);
    this.boundHandleWatchClick = this.handleWatchClick.bind(this);
    this.boundHandleTrySampleClick = this.handleTrySampleClick.bind(this);

    this.setupFileDrop();
    this.attachListeners();
  }

  /**
   * Attach all event listeners
   */
  private attachListeners(): void {
    this.fileSelectBtn?.addEventListener('click', this.boundHandleFileSelectClick);
    this.fileInput?.addEventListener('change', this.boundHandleFileInputChange);

    // Only add watch listener if API is supported
    if (this.watchToggle && FileWatcher.isSupported()) {
      this.watchToggle.addEventListener('click', this.boundHandleWatchClick);
    } else if (this.watchToggle) {
      (this.watchToggle as HTMLButtonElement).disabled = true;
      this.watchToggle.title = 'File watching requires Chromium-based browser';
    }

    this.trySampleBtn?.addEventListener('click', this.boundHandleTrySampleClick);
  }

  /**
   * Remove all event listeners
   */
  private detachListeners(): void {
    this.fileSelectBtn?.removeEventListener('click', this.boundHandleFileSelectClick);
    this.fileInput?.removeEventListener('change', this.boundHandleFileInputChange);
    this.watchToggle?.removeEventListener('click', this.boundHandleWatchClick);
    this.trySampleBtn?.removeEventListener('click', this.boundHandleTrySampleClick);
  }

  /**
   * Handle file select button click
   */
  private handleFileSelectClick(): void {
    this.fileInput?.click();
  }

  /**
   * Handle file input change
   */
  private async handleFileInputChange(): Promise<void> {
    if (this.disposed) return;

    const file = this.fileInput?.files?.[0];
    if (!file) return;

    try {
      const { content, displayName } = await this.readFile(file);
      await this.onLoad(content, displayName);
    } catch (error) {
      console.error('Failed to read file:', error);
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }

    // Reset input so the same file can be selected again
    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  /**
   * Handle watch toggle click
   */
  private async handleWatchClick(): Promise<void> {
    if (this.disposed) return;

    // If already watching, stop
    if (this.fileWatcher?.isWatching()) {
      this.stopWatching();
      this.showWatchNotification('Stopped watching');
      return;
    }

    // Create new watcher
    this.fileWatcher = new FileWatcher({
      onChange: async (content, filename) => {
        if (this.disposed) return;
        await this.onLoad(content, filename, false);
        this.showWatchNotification('File updated');
      },
      onError: (error) => {
        if (this.disposed) return;
        console.error('Watch error:', error);
        this.showWatchNotification('Watch stopped: ' + error.message);
        this.updateWatchButtonState();
      },
      pollInterval: 1000,
    });

    const result = await this.fileWatcher.openAndWatch();
    if (result) {
      await this.onLoad(result.content, result.filename);
      this.updateWatchButtonState();
      this.showWatchNotification(`Watching: ${result.filename}`);
    } else {
      // User cancelled or error
      this.fileWatcher = null;
      this.updateWatchButtonState();
    }
  }

  /**
   * Handle try sample button click
   */
  private async handleTrySampleClick(): Promise<void> {
    if (this.disposed) return;
    if (!this.trySampleBtn) return;
    if (this.trySampleBtn.classList.contains('loading')) return;

    const btnText = this.trySampleBtn.querySelector('.sample-preview-btn');
    try {
      this.trySampleBtn.classList.add('loading');
      if (btnText) btnText.textContent = 'Loading...';

      const response = await fetch('samples/sample-trace.jsonl.zstd');
      if (!response.ok) {
        throw new Error(`Failed to fetch sample: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const content = decompressZstdBuffer(buffer);
      await this.onLoad(content, 'sample-trace.jsonl', false, 'Thinking Tracer');
    } catch (error) {
      console.error('Failed to load sample:', error);
      this.onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.trySampleBtn.classList.remove('loading');
      if (btnText) btnText.textContent = 'See How This Was Built';
    }
  }

  /**
   * Setup file drop handling
   */
  private setupFileDrop(): void {
    initFileDrop({
      target: document.body,
      overlay: this.dropOverlay ?? undefined,
      accept: ['.json', '.jsonl'],
      onDrop: (content, filename) => this.onLoad(content, filename),
      onError: (error) => {
        console.error('File drop error:', error);
        this.onError(error);
      },
    });
  }


  /**
   * Read a file, handling compression
   */
  public async readFile(file: File): Promise<{ content: string; displayName: string }> {
    const name = file.name.toLowerCase();
    const isGzipped = name.endsWith('.gz');
    const isZstd = name.endsWith('.zst') || name.endsWith('.zstd');

    let content: string;
    let displayName = file.name;

    if (isGzipped) {
      content = await decompressGzip(file);
      displayName = file.name.slice(0, -3);
    } else if (isZstd) {
      content = await decompressZstdFile(file);
      displayName = name.endsWith('.zstd') ? file.name.slice(0, -5) : file.name.slice(0, -4);
    } else {
      content = await file.text();
    }

    return { content, displayName };
  }


  /**
   * Stop file watching
   */
  public stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.stop();
      this.fileWatcher = null;
      this.updateWatchButtonState();
    }
  }

  /**
   * Check if currently watching a file
   */
  public isWatching(): boolean {
    return this.fileWatcher?.isWatching() ?? false;
  }

  /**
   * Update watch button visual state
   */
  private updateWatchButtonState(): void {
    if (!this.watchToggle) return;

    if (this.fileWatcher?.isWatching()) {
      this.watchToggle.classList.add('watching');
      this.watchToggle.textContent = 'Watching';
    } else {
      this.watchToggle.classList.remove('watching');
      this.watchToggle.textContent = 'Watch';
    }
  }

  /**
   * Show a brief notification for watch events
   */
  private showWatchNotification(message: string): void {
    let notif = document.getElementById('watch-notification');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'watch-notification';
      notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(80, 200, 120, 0.95);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        z-index: 1000;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(notif);
    }

    notif.textContent = message;
    notif.style.opacity = '1';

    // Clear any existing timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    this.notificationTimeout = setTimeout(() => {
      this.notificationTimeout = null;
      notif!.style.opacity = '0';
    }, 2000);
  }


  /**
   * Load a file from a URL
   */
  public async loadFromUrl(url: string, filename: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const name = filename.toLowerCase();
    let content: string;

    if (name.endsWith('.zst') || name.endsWith('.zstd')) {
      const buffer = await response.arrayBuffer();
      content = decompressZstdBuffer(buffer);
    } else if (name.endsWith('.gz')) {
      const blob = await response.blob();
      const file = new File([blob], filename);
      content = await decompressGzip(file);
    } else {
      content = await response.text();
    }

    await this.onLoad(content, filename);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.disposed = true;
    this.detachListeners();
    this.stopWatching();

    // Clear notification timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = null;
    }
  }
}
