/**
 * File drag-and-drop utilities
 */

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
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!accept.includes(extension)) {
      onError?.(new Error(`Unsupported file type: ${extension}. Expected: ${accept.join(', ')}`));
      return;
    }

    try {
      const content = await file.text();
      onDrop(content, file.name);
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
