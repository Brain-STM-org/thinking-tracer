/**
 * Unit tests for FileLoader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileLoader } from './FileLoader';

// Mock the file-drop module
vi.mock('../../utils/file-drop', () => ({
  initFileDrop: vi.fn(),
  decompressGzip: vi.fn(),
  decompressZstdFile: vi.fn(),
  decompressZstdBuffer: vi.fn(),
  FileWatcher: {
    isSupported: vi.fn(() => true),
  },
}));

describe('FileLoader', () => {
  let fileInput: HTMLInputElement;
  let fileSelectBtn: HTMLButtonElement;
  let trySampleBtn: HTMLDivElement;
  let watchToggle: HTMLButtonElement;
  let dropOverlay: HTMLDivElement;
  let onLoadMock: ReturnType<typeof vi.fn>;
  let onErrorMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create DOM elements
    fileInput = document.createElement('input');
    fileInput.type = 'file';

    fileSelectBtn = document.createElement('button');
    trySampleBtn = document.createElement('div');
    watchToggle = document.createElement('button');
    dropOverlay = document.createElement('div');

    // Create mock callbacks
    onLoadMock = vi.fn().mockResolvedValue(undefined);
    onErrorMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates instance with all options', () => {
      const loader = new FileLoader({
        fileInput,
        fileSelectBtn,
        trySampleBtn,
        watchToggle,
        dropOverlay,
        onLoad: onLoadMock,
        onError: onErrorMock,
      });

      expect(loader).toBeInstanceOf(FileLoader);
      loader.dispose();
    });

    it('creates instance with null elements', () => {
      const loader = new FileLoader({
        fileInput: null,
        fileSelectBtn: null,
        trySampleBtn: null,
        watchToggle: null,
        dropOverlay: null,
        onLoad: onLoadMock,
      });

      expect(loader).toBeInstanceOf(FileLoader);
      loader.dispose();
    });
  });

  describe('hashContent', () => {
    it('generates consistent hash for same content', () => {
      const content = 'test content';
      const hash1 = FileLoader.hashContent(content);
      const hash2 = FileLoader.hashContent(content);
      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different content', () => {
      const hash1 = FileLoader.hashContent('content A');
      const hash2 = FileLoader.hashContent('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty string', () => {
      const hash = FileLoader.hashContent('');
      expect(hash).toBe('0-0');
    });

    it('handles long content', () => {
      const content = 'x'.repeat(20000);
      const hash = FileLoader.hashContent(content);
      expect(hash).toContain('-20000');
    });

    it('returns string in expected format', () => {
      const hash = FileLoader.hashContent('test');
      expect(hash).toMatch(/^-?[0-9a-f]+-\d+$/);
    });
  });

  describe('file select button', () => {
    it('triggers file input click on button click', () => {
      const loader = new FileLoader({
        fileInput,
        fileSelectBtn,
        trySampleBtn: null,
        watchToggle: null,
        dropOverlay: null,
        onLoad: onLoadMock,
      });

      const clickSpy = vi.spyOn(fileInput, 'click');
      fileSelectBtn.click();

      expect(clickSpy).toHaveBeenCalled();
      loader.dispose();
    });
  });

  describe('isWatching', () => {
    it('returns false initially', () => {
      const loader = new FileLoader({
        fileInput: null,
        fileSelectBtn: null,
        trySampleBtn: null,
        watchToggle: null,
        dropOverlay: null,
        onLoad: onLoadMock,
      });

      expect(loader.isWatching()).toBe(false);
      loader.dispose();
    });
  });

  describe('stopWatching', () => {
    it('can be called safely when not watching', () => {
      const loader = new FileLoader({
        fileInput: null,
        fileSelectBtn: null,
        trySampleBtn: null,
        watchToggle: null,
        dropOverlay: null,
        onLoad: onLoadMock,
      });

      expect(() => loader.stopWatching()).not.toThrow();
      loader.dispose();
    });
  });

  describe('dispose', () => {
    it('cleans up resources', () => {
      const loader = new FileLoader({
        fileInput,
        fileSelectBtn,
        trySampleBtn,
        watchToggle,
        dropOverlay,
        onLoad: onLoadMock,
      });

      expect(() => loader.dispose()).not.toThrow();
    });

    it('can be called multiple times', () => {
      const loader = new FileLoader({
        fileInput: null,
        fileSelectBtn: null,
        trySampleBtn: null,
        watchToggle: null,
        dropOverlay: null,
        onLoad: onLoadMock,
      });

      loader.dispose();
      expect(() => loader.dispose()).not.toThrow();
    });
  });
});
