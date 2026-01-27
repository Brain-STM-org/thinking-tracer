/**
 * Tests for Source Registry
 */

import { describe, it, expect } from 'vitest';
import { sourceRegistry, claudeCodeSource, type SourceConfig } from './index';

describe('SourceRegistry', () => {
  describe('built-in sources', () => {
    it('has claude-code registered by default', () => {
      expect(sourceRegistry.has('claude-code')).toBe(true);
    });

    it('can retrieve claude-code config', () => {
      const config = sourceRegistry.get('claude-code');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Claude Code');
    });

    it('lists all registered sources', () => {
      const all = sourceRegistry.getAll();
      expect(all.length).toBeGreaterThanOrEqual(1);
      expect(all.some(s => s.id === 'claude-code')).toBe(true);
    });

    it('lists all registered source IDs', () => {
      const ids = sourceRegistry.getIds();
      expect(ids).toContain('claude-code');
    });
  });

  describe('claudeCodeSource config', () => {
    it('has correct id and name', () => {
      expect(claudeCodeSource.id).toBe('claude-code');
      expect(claudeCodeSource.name).toBe('Claude Code');
    });

    it('lists supported file extensions', () => {
      expect(claudeCodeSource.fileExtensions).toContain('.jsonl');
    });

    it('has all required capabilities defined', () => {
      expect(claudeCodeSource.capabilities.hasSubAgents).toBe(true);
      expect(claudeCodeSource.capabilities.hasThinking).toBe(true);
      expect(claudeCodeSource.capabilities.hasToolUse).toBe(true);
      expect(claudeCodeSource.capabilities.hasSummaries).toBe(true);
    });

    it('has UI configuration', () => {
      expect(claudeCodeSource.ui.badges).toBeDefined();
      expect(claudeCodeSource.ui.metadataFields).toContain('model');
      expect(claudeCodeSource.ui.defaultTitle).toBe('Claude Code Session');
    });
  });

  describe('getUIText', () => {
    it('returns badge text for known source', () => {
      const text = sourceRegistry.getUIText('claude-code', 'sidechain', 'default');
      expect(text).toBe('sidechain');
    });

    it('returns fallback for unknown source', () => {
      const text = sourceRegistry.getUIText('unknown-source', 'sidechain', 'default');
      expect(text).toBe('default');
    });

    it('returns fallback for undefined source', () => {
      const text = sourceRegistry.getUIText(undefined, 'sidechain', 'default');
      expect(text).toBe('default');
    });
  });

  describe('getMetadataFields', () => {
    it('returns metadata fields for known source', () => {
      const fields = sourceRegistry.getMetadataFields('claude-code');
      expect(fields).toContain('model');
      expect(fields).toContain('git_branch');
    });

    it('returns default fields for unknown source', () => {
      const fields = sourceRegistry.getMetadataFields('unknown-source');
      expect(fields).toContain('model');
      expect(fields).toContain('duration_ms');
    });

    it('returns default fields for undefined source', () => {
      const fields = sourceRegistry.getMetadataFields(undefined);
      expect(fields).toContain('model');
    });
  });

  describe('hasCapability', () => {
    it('returns true for capabilities the source has', () => {
      expect(sourceRegistry.hasCapability('claude-code', 'hasThinking')).toBe(true);
      expect(sourceRegistry.hasCapability('claude-code', 'hasToolUse')).toBe(true);
    });

    it('returns false for unknown source', () => {
      expect(sourceRegistry.hasCapability('unknown', 'hasThinking')).toBe(false);
    });

    it('returns false for undefined source', () => {
      expect(sourceRegistry.hasCapability(undefined, 'hasThinking')).toBe(false);
    });
  });

  describe('register', () => {
    it('can register a new source', () => {
      const newSource: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        description: 'A test source',
        fileExtensions: ['.test'],
        ui: {
          badges: { test: 'Test Badge' },
          metadataFields: ['model'],
          defaultTitle: 'Test Session',
        },
        capabilities: {
          hasSubAgents: false,
          hasThinking: true,
          hasToolUse: false,
          hasSummaries: false,
        },
      };

      sourceRegistry.register(newSource);

      expect(sourceRegistry.has('test-source')).toBe(true);
      expect(sourceRegistry.get('test-source')?.name).toBe('Test Source');
      expect(sourceRegistry.hasCapability('test-source', 'hasThinking')).toBe(true);
      expect(sourceRegistry.hasCapability('test-source', 'hasSubAgents')).toBe(false);
    });
  });
});
