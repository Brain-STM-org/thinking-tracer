/**
 * Tests for the configuration module
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_THEME_CONFIG,
  DEFAULT_TIMING_CONFIG,
  DEFAULT_UI_CONFIG,
  createConfig,
  mergeConfig,
} from './index';
import {
  DEFAULT_COIL,
  DEFAULT_FOCUS,
  DEFAULT_NODE_SIZE,
  DEFAULT_EXPANDED,
  DEFAULT_CAMERA,
  DEFAULT_SELECTION,
} from './layout';
import {
  DEFAULT_NODE_THEMES,
  DEFAULT_HIGHLIGHT,
  DEFAULT_CONNECTION_LINE,
  DEFAULT_CLUSTER_LINE,
  DEFAULT_SCENE,
  DEFAULT_CHART_COLORS,
  DEFAULT_WORD_HIGHLIGHT_PALETTE,
  DEFAULT_UI_COLORS,
  hexToCSS,
  cssToHex,
} from './theme';
import {
  DEFAULT_ANIMATION_TIMING,
  DEFAULT_DEBOUNCE,
  DEFAULT_INTERVAL,
  DEFAULT_INTERACTION_TIMING,
} from './timing';
import {
  DEFAULT_SIDEBAR,
  DEFAULT_SPLIT_PANE,
  DEFAULT_CHART,
  DEFAULT_TEXT_DISPLAY,
  DEFAULT_SCROLL,
  DEFAULT_RENDERER,
} from './ui';

describe('config/layout', () => {
  it('DEFAULT_COIL has valid values', () => {
    expect(DEFAULT_COIL.radius).toBeGreaterThan(0);
    expect(DEFAULT_COIL.angleStep).toBeGreaterThan(0);
    expect(DEFAULT_COIL.verticalStep).toBeGreaterThan(0);
    expect(DEFAULT_COIL.tiltAngle).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_COIL.radiusGrowth).toBeGreaterThanOrEqual(0);
  });

  it('DEFAULT_FOCUS has valid values', () => {
    expect(DEFAULT_FOCUS.minVerticalSpacing).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_FOCUS.maxVerticalSpacing).toBeGreaterThan(DEFAULT_FOCUS.minVerticalSpacing);
    expect(DEFAULT_FOCUS.focusRadius).toBeGreaterThan(0);
  });

  it('DEFAULT_NODE_SIZE has valid values', () => {
    expect(DEFAULT_NODE_SIZE.clusterBase).toBeGreaterThan(0);
    expect(DEFAULT_NODE_SIZE.user).toHaveLength(3);
    expect(DEFAULT_NODE_SIZE.assistant).toHaveLength(3);
    expect(DEFAULT_NODE_SIZE.thinkingRadius).toBeGreaterThan(0);
    expect(DEFAULT_NODE_SIZE.thinkingSegments).toBeGreaterThan(0);
  });

  it('DEFAULT_CAMERA has valid values', () => {
    expect(DEFAULT_CAMERA.fov).toBeGreaterThan(0);
    expect(DEFAULT_CAMERA.fov).toBeLessThan(180);
    expect(DEFAULT_CAMERA.near).toBeGreaterThan(0);
    expect(DEFAULT_CAMERA.far).toBeGreaterThan(DEFAULT_CAMERA.near);
    expect(DEFAULT_CAMERA.minDistance).toBeGreaterThan(0);
    expect(DEFAULT_CAMERA.maxDistance).toBeGreaterThan(DEFAULT_CAMERA.minDistance);
    expect(DEFAULT_CAMERA.dampingFactor).toBeGreaterThan(0);
    expect(DEFAULT_CAMERA.dampingFactor).toBeLessThanOrEqual(1);
  });

  it('DEFAULT_SELECTION has valid scale factor', () => {
    expect(DEFAULT_SELECTION.selectedScale).toBeGreaterThan(1);
    expect(DEFAULT_SELECTION.visibilityThreshold).toBeGreaterThan(0);
    expect(DEFAULT_SELECTION.visibilityThreshold).toBeLessThan(1);
  });

  it('DEFAULT_LAYOUT_CONFIG combines all layout configs', () => {
    expect(DEFAULT_LAYOUT_CONFIG.coil).toBe(DEFAULT_COIL);
    expect(DEFAULT_LAYOUT_CONFIG.focus).toBe(DEFAULT_FOCUS);
    expect(DEFAULT_LAYOUT_CONFIG.nodeSize).toBe(DEFAULT_NODE_SIZE);
    expect(DEFAULT_LAYOUT_CONFIG.expanded).toBe(DEFAULT_EXPANDED);
    expect(DEFAULT_LAYOUT_CONFIG.camera).toBe(DEFAULT_CAMERA);
    expect(DEFAULT_LAYOUT_CONFIG.selection).toBe(DEFAULT_SELECTION);
  });
});

describe('config/theme', () => {
  it('DEFAULT_NODE_THEMES has all node types', () => {
    expect(DEFAULT_NODE_THEMES.user).toBeDefined();
    expect(DEFAULT_NODE_THEMES.assistant).toBeDefined();
    expect(DEFAULT_NODE_THEMES.thinking).toBeDefined();
    expect(DEFAULT_NODE_THEMES.toolUse).toBeDefined();
    expect(DEFAULT_NODE_THEMES.toolResult).toBeDefined();
    expect(DEFAULT_NODE_THEMES.cluster).toBeDefined();
  });

  it('node themes have valid colors and materials', () => {
    for (const [_key, theme] of Object.entries(DEFAULT_NODE_THEMES)) {
      expect(theme.color).toBeGreaterThanOrEqual(0);
      expect(theme.color).toBeLessThanOrEqual(0xffffff);
      expect(theme.material.roughness).toBeGreaterThanOrEqual(0);
      expect(theme.material.roughness).toBeLessThanOrEqual(1);
    }
  });

  it('DEFAULT_HIGHLIGHT has valid values', () => {
    expect(DEFAULT_HIGHLIGHT.color).toBe(0xffffff);
    expect(DEFAULT_HIGHLIGHT.material.roughness).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_HIGHLIGHT.searchColor).toBeGreaterThanOrEqual(0);
  });

  it('DEFAULT_CONNECTION_LINE has valid values', () => {
    expect(DEFAULT_CONNECTION_LINE.color).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONNECTION_LINE.opacity).toBeGreaterThan(0);
    expect(DEFAULT_CONNECTION_LINE.opacity).toBeLessThanOrEqual(1);
    expect(DEFAULT_CONNECTION_LINE.width).toBeGreaterThan(0);
  });

  it('DEFAULT_SCENE has valid lighting values', () => {
    expect(DEFAULT_SCENE.background).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SCENE.ambientLightIntensity).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SCENE.mainLightIntensity).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SCENE.fillLightIntensity).toBeGreaterThanOrEqual(0);
  });

  it('DEFAULT_WORD_HIGHLIGHT_PALETTE has 10 colors', () => {
    expect(DEFAULT_WORD_HIGHLIGHT_PALETTE).toHaveLength(10);
    for (const color of DEFAULT_WORD_HIGHLIGHT_PALETTE) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('DEFAULT_THEME_CONFIG combines all theme configs', () => {
    expect(DEFAULT_THEME_CONFIG.nodes).toBe(DEFAULT_NODE_THEMES);
    expect(DEFAULT_THEME_CONFIG.highlight).toBe(DEFAULT_HIGHLIGHT);
    expect(DEFAULT_THEME_CONFIG.connectionLine).toBe(DEFAULT_CONNECTION_LINE);
    expect(DEFAULT_THEME_CONFIG.clusterLine).toBe(DEFAULT_CLUSTER_LINE);
    expect(DEFAULT_THEME_CONFIG.scene).toBe(DEFAULT_SCENE);
    expect(DEFAULT_THEME_CONFIG.chart).toBe(DEFAULT_CHART_COLORS);
    expect(DEFAULT_THEME_CONFIG.wordHighlightPalette).toBe(DEFAULT_WORD_HIGHLIGHT_PALETTE);
    expect(DEFAULT_THEME_CONFIG.ui).toBe(DEFAULT_UI_COLORS);
  });

  describe('hexToCSS', () => {
    it('converts hex number to CSS string', () => {
      expect(hexToCSS(0xffffff)).toBe('#ffffff');
      expect(hexToCSS(0x000000)).toBe('#000000');
      expect(hexToCSS(0x4a90d9)).toBe('#4a90d9');
      expect(hexToCSS(0x1a1a2e)).toBe('#1a1a2e');
    });

    it('pads short hex values', () => {
      expect(hexToCSS(0x000001)).toBe('#000001');
      expect(hexToCSS(0x0000ff)).toBe('#0000ff');
    });
  });

  describe('cssToHex', () => {
    it('converts CSS string to hex number', () => {
      expect(cssToHex('#ffffff')).toBe(0xffffff);
      expect(cssToHex('#000000')).toBe(0x000000);
      expect(cssToHex('#4a90d9')).toBe(0x4a90d9);
      expect(cssToHex('1a1a2e')).toBe(0x1a1a2e); // without #
    });

    it('is inverse of hexToCSS', () => {
      const testColors = [0xffffff, 0x000000, 0x4a90d9, 0xe74c3c, 0x1a1a2e];
      for (const color of testColors) {
        expect(cssToHex(hexToCSS(color))).toBe(color);
      }
    });
  });
});

describe('config/timing', () => {
  it('DEFAULT_ANIMATION_TIMING has positive durations', () => {
    expect(DEFAULT_ANIMATION_TIMING.layoutTransition).toBeGreaterThan(0);
    expect(DEFAULT_ANIMATION_TIMING.cameraTransition).toBeGreaterThan(0);
    expect(DEFAULT_ANIMATION_TIMING.scrollLock).toBeGreaterThan(0);
    expect(DEFAULT_ANIMATION_TIMING.clickScrollLock).toBeGreaterThan(0);
    expect(DEFAULT_ANIMATION_TIMING.scrollDebounce).toBeGreaterThan(0);
  });

  it('DEFAULT_DEBOUNCE has reasonable values', () => {
    expect(DEFAULT_DEBOUNCE.search).toBeGreaterThan(0);
    expect(DEFAULT_DEBOUNCE.initialRender).toBeGreaterThan(0);
    expect(DEFAULT_DEBOUNCE.stateRestore).toBeGreaterThan(0);
  });

  it('DEFAULT_INTERVAL has reasonable values', () => {
    expect(DEFAULT_INTERVAL.autoSave).toBeGreaterThan(1000);
    expect(DEFAULT_INTERVAL.fileWatchPoll).toBeGreaterThan(0);
    expect(DEFAULT_INTERVAL.notificationDuration).toBeGreaterThan(0);
  });

  it('DEFAULT_INTERACTION_TIMING has valid click detection values', () => {
    expect(DEFAULT_INTERACTION_TIMING.doubleClickWindow).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_TIMING.maxClickDuration).toBeGreaterThan(0);
    expect(DEFAULT_INTERACTION_TIMING.maxClickDistance).toBeGreaterThan(0);
  });

  it('DEFAULT_TIMING_CONFIG combines all timing configs', () => {
    expect(DEFAULT_TIMING_CONFIG.animation).toBe(DEFAULT_ANIMATION_TIMING);
    expect(DEFAULT_TIMING_CONFIG.debounce).toBe(DEFAULT_DEBOUNCE);
    expect(DEFAULT_TIMING_CONFIG.interval).toBe(DEFAULT_INTERVAL);
    expect(DEFAULT_TIMING_CONFIG.interaction).toBe(DEFAULT_INTERACTION_TIMING);
  });
});

describe('config/ui', () => {
  it('DEFAULT_SIDEBAR has valid constraints', () => {
    expect(DEFAULT_SIDEBAR.minWidth).toBeGreaterThan(0);
    expect(DEFAULT_SIDEBAR.maxWidth).toBeGreaterThan(DEFAULT_SIDEBAR.minWidth);
    expect(DEFAULT_SIDEBAR.defaultWidth).toBeGreaterThanOrEqual(DEFAULT_SIDEBAR.minWidth);
    expect(DEFAULT_SIDEBAR.defaultWidth).toBeLessThanOrEqual(DEFAULT_SIDEBAR.maxWidth);
  });

  it('DEFAULT_SPLIT_PANE has valid constraints', () => {
    expect(DEFAULT_SPLIT_PANE.minCanvasWidth).toBeGreaterThan(0);
    expect(DEFAULT_SPLIT_PANE.minConversationWidth).toBeGreaterThan(0);
    expect(DEFAULT_SPLIT_PANE.handleWidth).toBeGreaterThan(0);
  });

  it('DEFAULT_CHART has valid values', () => {
    expect(DEFAULT_CHART.minBarWidth).toBeGreaterThan(0);
    expect(DEFAULT_CHART.barGap).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CHART.height).toBeGreaterThan(0);
    expect(DEFAULT_CHART.minBarHeight).toBeGreaterThan(0);
  });

  it('DEFAULT_SCROLL has valid focus ratio', () => {
    expect(DEFAULT_SCROLL.focusPointRatio).toBeGreaterThan(0);
    expect(DEFAULT_SCROLL.focusPointRatio).toBeLessThan(1);
  });

  it('DEFAULT_RENDERER has valid pixel ratio limit', () => {
    expect(DEFAULT_RENDERER.maxPixelRatio).toBeGreaterThan(0);
  });

  it('DEFAULT_UI_CONFIG combines all UI configs', () => {
    expect(DEFAULT_UI_CONFIG.sidebar).toBe(DEFAULT_SIDEBAR);
    expect(DEFAULT_UI_CONFIG.splitPane).toBe(DEFAULT_SPLIT_PANE);
    expect(DEFAULT_UI_CONFIG.chart).toBe(DEFAULT_CHART);
    expect(DEFAULT_UI_CONFIG.textDisplay).toBe(DEFAULT_TEXT_DISPLAY);
    expect(DEFAULT_UI_CONFIG.scroll).toBe(DEFAULT_SCROLL);
    expect(DEFAULT_UI_CONFIG.renderer).toBe(DEFAULT_RENDERER);
  });
});

describe('config/index', () => {
  it('DEFAULT_APP_CONFIG combines all config modules', () => {
    expect(DEFAULT_APP_CONFIG.layout).toBe(DEFAULT_LAYOUT_CONFIG);
    expect(DEFAULT_APP_CONFIG.theme).toBe(DEFAULT_THEME_CONFIG);
    expect(DEFAULT_APP_CONFIG.timing).toBe(DEFAULT_TIMING_CONFIG);
    expect(DEFAULT_APP_CONFIG.ui).toBe(DEFAULT_UI_CONFIG);
  });

  describe('createConfig', () => {
    it('returns defaults when no overrides', () => {
      const config = createConfig({});
      expect(config.layout).toEqual(DEFAULT_LAYOUT_CONFIG);
      expect(config.theme).toEqual(DEFAULT_THEME_CONFIG);
      expect(config.timing).toEqual(DEFAULT_TIMING_CONFIG);
      expect(config.ui).toEqual(DEFAULT_UI_CONFIG);
    });

    it('merges shallow overrides', () => {
      const config = createConfig({
        layout: { ...DEFAULT_LAYOUT_CONFIG, coil: { ...DEFAULT_COIL, radius: 10 } },
      });
      expect(config.layout.coil.radius).toBe(10);
      expect(config.layout.coil.angleStep).toBe(DEFAULT_COIL.angleStep);
    });
  });

  describe('mergeConfig', () => {
    it('returns base when no overrides', () => {
      const base = { a: 1, b: 2 };
      const result = mergeConfig(base, {});
      expect(result).toEqual(base);
    });

    it('merges top-level properties', () => {
      const base = { a: 1, b: 2 };
      const result = mergeConfig(base, { a: 10 });
      expect(result).toEqual({ a: 10, b: 2 });
    });

    it('deeply merges nested objects', () => {
      const base = { nested: { x: 1, y: 2 }, top: 'value' };
      const result = mergeConfig(base, { nested: { x: 10, y: 2 } });
      expect(result).toEqual({ nested: { x: 10, y: 2 }, top: 'value' });
    });

    it('does not modify original objects', () => {
      const base = { nested: { x: 1 } };
      const result = mergeConfig(base, { nested: { x: 10 } });
      expect(base.nested.x).toBe(1);
      expect(result.nested.x).toBe(10);
    });

    it('handles array values by replacement', () => {
      const base = { arr: [1, 2, 3] };
      const result = mergeConfig(base, { arr: [4, 5] });
      expect(result.arr).toEqual([4, 5]);
    });

    it('handles undefined values by keeping original', () => {
      const base = { a: 1, b: 2 };
      const result = mergeConfig(base, { a: undefined });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });
});
