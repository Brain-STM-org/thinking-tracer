/**
 * Unit tests for RecentTracesManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecentTracesManager, type RecentTrace } from './RecentTracesManager';

// Mock the recent-traces module
vi.mock('../../utils/recent-traces', () => ({
  saveRecentTrace: vi.fn().mockResolvedValue(undefined),
  getRecentTraces: vi.fn().mockResolvedValue([]),
  deleteRecentTrace: vi.fn().mockResolvedValue(undefined),
  clearRecentTraces: vi.fn().mockResolvedValue(undefined),
  updateTraceCustomName: vi.fn().mockResolvedValue(undefined),
  updateTraceUIState: vi.fn().mockResolvedValue(undefined),
  formatSize: vi.fn((size: number) => `${size} bytes`),
  formatRelativeTime: vi.fn(() => 'just now'),
}));

// Mock the export module
vi.mock('../../export', () => ({
  escapeHtml: vi.fn((str: string) => str),
}));

// Import mocked functions for assertions
import {
  getRecentTraces,
  deleteRecentTrace,
  clearRecentTraces,
  saveRecentTrace,
  updateTraceCustomName,
  updateTraceUIState,
} from '../../utils/recent-traces';

describe('RecentTracesManager', () => {
  let container: HTMLDivElement;
  let listElement: HTMLDivElement;
  let clearBtn: HTMLButtonElement;
  let onSelectMock: ReturnType<typeof vi.fn>;

  const mockTrace: RecentTrace = {
    id: 'trace-1',
    filename: '/path/to/trace.jsonl',
    title: 'Test Trace',
    turnCount: 10,
    size: 1024,
    lastOpened: Date.now(),
    content: '{"test": true}',
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create DOM elements
    container = document.createElement('div');
    listElement = document.createElement('div');
    clearBtn = document.createElement('button');

    onSelectMock = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates instance with all options', () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      expect(manager).toBeInstanceOf(RecentTracesManager);
      manager.dispose();
    });

    it('creates instance with null elements', () => {
      const manager = new RecentTracesManager({
        container: null,
        listElement: null,
        clearBtn: null,
        onSelect: onSelectMock,
      });

      expect(manager).toBeInstanceOf(RecentTracesManager);
      manager.dispose();
    });
  });

  describe('refresh', () => {
    it('fetches traces from storage', async () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(getRecentTraces).toHaveBeenCalled();
      manager.dispose();
    });

    it('hides container when no traces', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(container.classList.contains('hidden')).toBe(true);
      manager.dispose();
    });

    it('shows container when traces exist', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([mockTrace]);
      container.classList.add('hidden');

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(container.classList.contains('hidden')).toBe(false);
      manager.dispose();
    });

    it('renders trace items', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([mockTrace]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(listElement.innerHTML).toContain('recent-item');
      expect(listElement.innerHTML).toContain('Test Trace');
      manager.dispose();
    });

    it('handles errors gracefully', async () => {
      vi.mocked(getRecentTraces).mockRejectedValueOnce(new Error('Storage error'));

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(container.classList.contains('hidden')).toBe(true);
      manager.dispose();
    });

    it('does nothing when disposed', async () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      manager.dispose();
      await manager.refresh();

      expect(getRecentTraces).not.toHaveBeenCalled();
    });
  });

  describe('trace item interactions', () => {
    it('calls onSelect when trace item is clicked', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([mockTrace]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      const item = listElement.querySelector('.recent-item') as HTMLElement;
      item.click();

      expect(onSelectMock).toHaveBeenCalledWith(mockTrace);
      manager.dispose();
    });

    it('deletes trace when delete button is clicked', async () => {
      vi.mocked(getRecentTraces)
        .mockResolvedValueOnce([mockTrace])
        .mockResolvedValueOnce([]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      const deleteBtn = listElement.querySelector('.recent-item-delete') as HTMLElement;
      deleteBtn.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(deleteRecentTrace).toHaveBeenCalledWith('trace-1');
      manager.dispose();
    });

    it('does not call onSelect when delete button is clicked', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([mockTrace]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      const deleteBtn = listElement.querySelector('.recent-item-delete') as HTMLElement;
      deleteBtn.click();

      expect(onSelectMock).not.toHaveBeenCalled();
      manager.dispose();
    });
  });

  describe('clear button', () => {
    it('clears all traces when confirmed', async () => {
      vi.mocked(getRecentTraces).mockResolvedValue([]);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      clearBtn.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(clearRecentTraces).toHaveBeenCalled();
      manager.dispose();
    });

    it('does not clear when cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      clearBtn.click();

      expect(clearRecentTraces).not.toHaveBeenCalled();
      manager.dispose();
    });
  });

  describe('saveTrace', () => {
    it('saves trace to storage', async () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.saveTrace('file.jsonl', 'Title', 5, '{"content": true}');

      expect(saveRecentTrace).toHaveBeenCalledWith('file.jsonl', 'Title', 5, '{"content": true}');
      manager.dispose();
    });

    it('handles save errors gracefully', async () => {
      vi.mocked(saveRecentTrace).mockRejectedValueOnce(new Error('Save failed'));

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await expect(manager.saveTrace('file.jsonl', 'Title', 5, '{}')).resolves.toBeUndefined();
      manager.dispose();
    });
  });

  describe('touchTrace', () => {
    it('updates last opened time', async () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.touchTrace(mockTrace);

      expect(saveRecentTrace).toHaveBeenCalledWith(
        mockTrace.filename,
        mockTrace.title,
        mockTrace.turnCount,
        mockTrace.content
      );
      manager.dispose();
    });
  });

  describe('updateCustomName', () => {
    it('updates trace custom name', async () => {
      vi.mocked(getRecentTraces).mockResolvedValue([]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.updateCustomName('trace-1', 'New Name');

      expect(updateTraceCustomName).toHaveBeenCalledWith('trace-1', 'New Name');
      manager.dispose();
    });
  });

  describe('updateUIState', () => {
    it('updates trace UI state', async () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      const uiState = {
        cameraPosition: [1, 2, 3] as [number, number, number],
        cameraTarget: [0, 0, 0] as [number, number, number],
        viewMode: 'split' as const,
      };

      await manager.updateUIState('trace-1', uiState);

      expect(updateTraceUIState).toHaveBeenCalledWith('trace-1', uiState);
      manager.dispose();
    });
  });

  describe('getTraceCount', () => {
    it('returns 0 initially', () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      expect(manager.getTraceCount()).toBe(0);
      manager.dispose();
    });

    it('returns count after refresh', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([mockTrace, { ...mockTrace, id: 'trace-2' }]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(manager.getTraceCount()).toBe(2);
      manager.dispose();
    });
  });

  describe('hasTraces', () => {
    it('returns false initially', () => {
      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      expect(manager.hasTraces()).toBe(false);
      manager.dispose();
    });

    it('returns true after refresh with traces', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([mockTrace]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(manager.hasTraces()).toBe(true);
      manager.dispose();
    });
  });

  describe('rendering', () => {
    it('shows custom name when available', async () => {
      const traceWithCustomName = { ...mockTrace, customName: 'Custom Title' };
      vi.mocked(getRecentTraces).mockResolvedValueOnce([traceWithCustomName]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(listElement.innerHTML).toContain('Custom Title');
      expect(listElement.innerHTML).toContain('custom');
      manager.dispose();
    });

    it('truncates long filenames', async () => {
      const traceWithLongPath = {
        ...mockTrace,
        filename: '/very/long/path/that/exceeds/fifty/characters/for/testing/purposes/trace.jsonl',
      };
      vi.mocked(getRecentTraces).mockResolvedValueOnce([traceWithLongPath]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(listElement.innerHTML).toContain('...');
      manager.dispose();
    });

    it('includes turn count and size', async () => {
      vi.mocked(getRecentTraces).mockResolvedValueOnce([mockTrace]);

      const manager = new RecentTracesManager({
        container,
        listElement,
        clearBtn,
        onSelect: onSelectMock,
      });

      await manager.refresh();

      expect(listElement.innerHTML).toContain('10 turns');
      expect(listElement.innerHTML).toContain('1024 bytes');
      manager.dispose();
    });
  });
});
