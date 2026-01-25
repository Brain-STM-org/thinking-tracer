/**
 * Main Viewer class - the primary API for thinking-tracer
 */

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Scene, type SceneOptions } from './Scene';
import { Controls } from './Controls';
import type { Conversation, Turn, ContentBlock } from '../data/types';
import { claudeCodeParser } from '../data/parsers/claude-code';
import {
  buildClusters as buildClustersFromConversation,
  extractSearchableContent,
  calculateClusterMetrics,
  type TurnCluster,
} from './clusters';
import {
  getSpiralPosition as getLayoutPosition,
  type CoilLayoutParams,
} from './layout';
import {
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_THEME_CONFIG,
  DEFAULT_TIMING_CONFIG,
} from '../config';

export interface ViewerOptions extends Omit<SceneOptions, 'container'> {
  /** Container element or selector */
  container: HTMLElement | string;
}

export interface ViewerStats {
  turns: number;
  thinkingBlocks: number;
  toolCalls: number;
  totalTokens: number;
}

/** Node types for visualization */
type NodeType = 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result' | 'document' | 'cluster';

/** Visual node in the scene */
interface VisualNode {
  mesh: THREE.Mesh;
  type: NodeType;
  data: Turn | ContentBlock | TurnCluster;
  turnIndex: number;
  clusterIndex?: number;
  originalMaterial: THREE.Material;
  targetPosition?: THREE.Vector3;
  targetScale?: number;
}

// TurnCluster is imported from './clusters'

/** Selection info passed to callback */
export interface SelectionInfo {
  type: NodeType;
  data: Turn | ContentBlock | TurnCluster;
  turnIndex: number;
  clusterIndex?: number;
}

// Config defaults for use within this module
const config = {
  layout: DEFAULT_LAYOUT_CONFIG,
  theme: DEFAULT_THEME_CONFIG,
  timing: DEFAULT_TIMING_CONFIG,
};

export class Viewer {
  private scene: Scene;
  private controls: Controls;
  private container: HTMLElement;
  private conversation: Conversation | null = null;
  private nodes: VisualNode[] = [];
  private clusters: TurnCluster[] = [];
  private statsCallback?: (stats: ViewerStats) => void;
  private selectCallback?: (selection: SelectionInfo | null) => void;

  // Selection state
  private selectedNode: VisualNode | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Word highlight state
  private highlightedClusters: Map<number, THREE.Material> = new Map(); // clusterIndex -> original material
  private clusterHighlightColors: Map<number, number> = new Map(); // clusterIndex -> color

  // Animation state
  private animating = false;
  private animationStart = 0;
  private animatingNodes: VisualNode[] = [];

  // Camera animation state
  private cameraAnimating = false;
  private cameraAnimStart = 0;
  private cameraStartPos = new THREE.Vector3();
  private cameraTargetPos = new THREE.Vector3();
  private cameraStartLookAt = new THREE.Vector3();
  private cameraTargetLookAt = new THREE.Vector3();

  // Double-click detection
  private lastClickTime = 0;
  private lastClickedNode: VisualNode | null = null;

  // Click detection state (for distinguishing clicks from drags)
  private mouseDownPos = { x: 0, y: 0 };
  private mouseDownTime = 0;

  // Periodic callback for tasks like autosave (called from render loop)
  private periodicCallback?: () => void;
  private periodicIntervalSeconds = 30;
  private timeSincePeriodicCallback = 0;

  // Materials for different node types
  private materials: Record<NodeType, THREE.MeshStandardMaterial>;
  private highlightMaterial: THREE.MeshStandardMaterial;
  private sidechainMaterial: THREE.MeshStandardMaterial;
  private errorMaterial: THREE.MeshStandardMaterial;

  // Connection lines between nodes
  private connectionLines: Line2[] = [];
  private connectionLineGeometries: LineGeometry[] = [];
  private clusterLine: Line2 | null = null;
  private clusterLineGeometry: LineGeometry | null = null;
  private showClusterLines = true;
  private lineMaterial: LineMaterial;
  private clusterLineMaterial: LineMaterial;

  // Layout parameters - helix
  private radius = config.layout.coil.radius;
  private angleStep = config.layout.coil.angleStep;
  private verticalStep = config.layout.coil.verticalStep;
  private tiltAngle = config.layout.coil.tiltAngle;
  private radiusGrowth = config.layout.coil.radiusGrowth;
  private readonly expandedSpacing = config.layout.expanded.turnSpacing;
  private readonly blockSpacing = config.layout.expanded.blockSpacing;
  private descendAngle = config.layout.expanded.descendAngle;

  // Slinky effect parameters
  private focusClusterIndex = 0;
  private minVerticalSpacing = config.layout.focus.minVerticalSpacing;
  private maxVerticalSpacing = config.layout.focus.maxVerticalSpacing;
  private focusRadius = config.layout.focus.focusRadius;

  // Search filter - null means show all, Set means show only those clusters
  private searchFilterClusters: Set<number> | null = null;

  // Bound event handlers for cleanup
  private boundHandleResize: () => void;
  private boundHandleMouseDown: (e: MouseEvent) => void;
  private boundHandleMouseUp: (e: MouseEvent) => void;
  private boundHandleKeyDown: (e: KeyboardEvent) => void;

  constructor(options: ViewerOptions) {
    const container =
      typeof options.container === 'string'
        ? document.querySelector<HTMLElement>(options.container)
        : options.container;

    if (!container) {
      throw new Error('Container element not found');
    }

    this.container = container;
    this.scene = new Scene({ ...options, container });

    this.controls = new Controls({
      camera: this.scene.camera,
      domElement: this.scene.renderer.domElement,
    });

    // Initialize materials from theme config
    const { nodes: nodeThemes, highlight, connectionLine, clusterLine } = config.theme;
    this.materials = {
      user: new THREE.MeshStandardMaterial({
        color: nodeThemes.user.color,
        roughness: nodeThemes.user.material.roughness,
      }),
      assistant: new THREE.MeshStandardMaterial({
        color: nodeThemes.assistant.color,
        roughness: nodeThemes.assistant.material.roughness,
      }),
      thinking: new THREE.MeshStandardMaterial({
        color: nodeThemes.thinking.color,
        roughness: nodeThemes.thinking.material.roughness,
        transparent: nodeThemes.thinking.material.transparent,
        opacity: nodeThemes.thinking.material.opacity,
      }),
      tool_use: new THREE.MeshStandardMaterial({
        color: nodeThemes.toolUse.color,
        roughness: nodeThemes.toolUse.material.roughness,
      }),
      tool_result: new THREE.MeshStandardMaterial({
        color: nodeThemes.toolResult.color,
        roughness: nodeThemes.toolResult.material.roughness,
      }),
      document: new THREE.MeshStandardMaterial({
        color: nodeThemes.document.color,
        roughness: nodeThemes.document.material.roughness,
        metalness: nodeThemes.document.material.metalness,
      }),
      cluster: this.createClusterMaterial(),
    };

    // Highlight material for selected nodes
    this.highlightMaterial = new THREE.MeshStandardMaterial({
      color: highlight.color,
      roughness: highlight.material.roughness,
      emissive: highlight.material.emissive,
    });

    // Sidechain material: muted, slightly transparent
    this.sidechainMaterial = new THREE.MeshStandardMaterial({
      color: nodeThemes.cluster.color,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
    });

    // Error material: red-tinted
    this.errorMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc4444,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x331111,
    });

    // Line material for connections within expanded clusters
    this.lineMaterial = new LineMaterial({
      color: connectionLine.color,
      transparent: true,
      opacity: connectionLine.opacity,
      linewidth: connectionLine.width,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    // Line material for cluster-to-cluster connections
    this.clusterLineMaterial = new LineMaterial({
      color: clusterLine.color,
      transparent: true,
      opacity: clusterLine.opacity,
      linewidth: clusterLine.width,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    // Bind event handlers
    this.boundHandleResize = this.handleResize.bind(this);
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);

    // Attach event listeners
    this.attachListeners();

    // Start render loop
    this.scene.start((deltaTime) => {
      this.controls.update();
      this.updateAnimation(deltaTime);
      this.updatePeriodicCallback(deltaTime);
    });
  }

  /**
   * Create gradient-like material for clusters
   */
  private createClusterMaterial(): THREE.MeshStandardMaterial {
    const { cluster } = config.theme.nodes;
    return new THREE.MeshStandardMaterial({
      color: cluster.color,
      roughness: cluster.material.roughness,
      metalness: cluster.material.metalness,
    });
  }

  /**
   * Attach all event listeners
   */
  private attachListeners(): void {
    window.addEventListener('resize', this.boundHandleResize);
    window.addEventListener('keydown', this.boundHandleKeyDown);
    this.scene.renderer.domElement.addEventListener('mousedown', this.boundHandleMouseDown);
    this.scene.renderer.domElement.addEventListener('mouseup', this.boundHandleMouseUp);
  }

  /**
   * Remove all event listeners
   */
  private detachListeners(): void {
    window.removeEventListener('resize', this.boundHandleResize);
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    this.scene.renderer.domElement.removeEventListener('mousedown', this.boundHandleMouseDown);
    this.scene.renderer.domElement.removeEventListener('mouseup', this.boundHandleMouseUp);
  }

  /**
   * Handle window resize - update line material resolution
   */
  private handleResize(): void {
    this.lineMaterial.resolution.set(window.innerWidth, window.innerHeight);
    this.clusterLineMaterial.resolution.set(window.innerWidth, window.innerHeight);
  }

  /**
   * Handle mouse down - track for click detection
   */
  private handleMouseDown(event: MouseEvent): void {
    this.mouseDownPos = { x: event.clientX, y: event.clientY };
    this.mouseDownTime = Date.now();
  }

  /**
   * Handle mouse up - detect clicks (vs drags)
   */
  private handleMouseUp(event: MouseEvent): void {
    const dx = event.clientX - this.mouseDownPos.x;
    const dy = event.clientY - this.mouseDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - this.mouseDownTime;
    const { maxClickDistance, maxClickDuration } = config.timing.interaction;

    if (dist < maxClickDistance && duration < maxClickDuration) {
      this.handleClick(event);
    }
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Don't handle if focus is on an input element
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.selectNext();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.selectPrevious();
        break;
      case 'Escape':
        this.clearSelection();
        break;
      case 'Home':
        event.preventDefault();
        this.selectFirst();
        break;
      case 'End':
        event.preventDefault();
        this.selectLast();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.toggleSelectedCluster();
        break;
      case 'Backspace':
        event.preventDefault();
        this.collapseSelected();
        break;
    }
  }

  /**
   * Toggle expand/collapse of selected cluster
   */
  private toggleSelectedCluster(): void {
    if (!this.selectedNode) return;

    if (this.selectedNode.type === 'cluster') {
      const cluster = this.selectedNode.data as TurnCluster;
      this.toggleCluster(cluster.index);
    } else if (this.selectedNode.clusterIndex !== undefined) {
      // If a child node is selected, toggle its parent cluster
      this.toggleCluster(this.selectedNode.clusterIndex);
    }
  }

  /**
   * Collapse the selected node's cluster
   */
  private collapseSelected(): void {
    if (!this.selectedNode) return;

    if (this.selectedNode.clusterIndex !== undefined) {
      const cluster = this.clusters[this.selectedNode.clusterIndex];
      if (cluster.expanded) {
        this.toggleCluster(cluster.index);
      }
    }
  }

  /**
   * Select the next node
   */
  private selectNext(): void {
    const selectableNodes = this.getSelectableNodes();
    if (selectableNodes.length === 0) return;

    if (!this.selectedNode) {
      this.selectNode(selectableNodes[0]);
    } else {
      const currentIndex = selectableNodes.indexOf(this.selectedNode);
      const nextIndex = (currentIndex + 1) % selectableNodes.length;
      this.selectNode(selectableNodes[nextIndex]);
    }
  }

  /**
   * Select the previous node
   */
  private selectPrevious(): void {
    const selectableNodes = this.getSelectableNodes();
    if (selectableNodes.length === 0) return;

    if (!this.selectedNode) {
      this.selectNode(selectableNodes[selectableNodes.length - 1]);
    } else {
      const currentIndex = selectableNodes.indexOf(this.selectedNode);
      const prevIndex = currentIndex === 0 ? selectableNodes.length - 1 : currentIndex - 1;
      this.selectNode(selectableNodes[prevIndex]);
    }
  }

  /**
   * Get nodes that are currently selectable (visible)
   */
  private getSelectableNodes(): VisualNode[] {
    const threshold = config.layout.selection.visibilityThreshold;
    return this.nodes.filter(n => n.mesh.visible && n.mesh.scale.x > threshold);
  }

  /**
   * Select the first node
   */
  private selectFirst(): void {
    const selectableNodes = this.getSelectableNodes();
    if (selectableNodes.length > 0) {
      this.selectNode(selectableNodes[0]);
    }
  }

  /**
   * Select the last node
   */
  private selectLast(): void {
    const selectableNodes = this.getSelectableNodes();
    if (selectableNodes.length > 0) {
      this.selectNode(selectableNodes[selectableNodes.length - 1]);
    }
  }

  /**
   * Handle click event for selection
   */
  private handleClick(event: MouseEvent): void {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.scene.camera);

    const visibleMeshes = this.nodes.filter(n => n.mesh.visible).map(n => n.mesh);
    const intersects = this.raycaster.intersectObjects(visibleMeshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const node = this.nodes.find(n => n.mesh === mesh);

      if (node) {
        const now = Date.now();
        const { doubleClickWindow } = config.timing.interaction;
        const isDoubleClick = (now - this.lastClickTime < doubleClickWindow) && (this.lastClickedNode === node);

        if (isDoubleClick && node.type === 'cluster') {
          // Double-click on cluster: toggle expand/collapse
          const cluster = node.data as TurnCluster;
          this.toggleCluster(cluster.index);
        } else {
          // Single click: select
          this.selectNode(node);
        }

        this.lastClickTime = now;
        this.lastClickedNode = node;
      }
    } else {
      this.clearSelection();
      this.lastClickedNode = null;
    }
  }

  /**
   * Select a node
   */
  private selectNode(node: VisualNode): void {
    // Deselect previous
    if (this.selectedNode && this.selectedNode !== node) {
      this.selectedNode.mesh.material = this.selectedNode.originalMaterial;
      // Restore previous node's scale
      this.restoreNodeScale(this.selectedNode);
    }

    // Select new
    this.selectedNode = node;
    node.mesh.material = this.highlightMaterial;

    // Scale up the selected node
    this.enlargeNode(node);

    // Update focus to the selected cluster (slinky effect)
    if (node.clusterIndex !== undefined) {
      this.setFocus(node.clusterIndex);
    }

    // Gently adjust camera to keep node in view (not aggressive centering)
    this.gentlyCameraAdjust(node);

    // Notify callback
    this.selectCallback?.({
      type: node.type,
      data: node.data,
      turnIndex: node.turnIndex,
      clusterIndex: node.clusterIndex,
    });
  }

  /**
   * Enlarge a node by the selected scale factor
   */
  private enlargeNode(node: VisualNode): void {
    // Store original scale if not stored
    if ((node as any).originalScale === undefined) {
      (node as any).originalScale = node.mesh.scale.x;
    }
    const originalScale = (node as any).originalScale as number;
    const { selectedScale } = config.layout.selection;
    node.mesh.scale.setScalar(originalScale * selectedScale);
  }

  /**
   * Restore a node to its original scale
   */
  private restoreNodeScale(node: VisualNode): void {
    const originalScale = (node as any).originalScale as number | undefined;
    if (originalScale !== undefined) {
      node.mesh.scale.setScalar(originalScale);
    }
  }

  /**
   * Gently adjust camera to keep node visible (just update look-at, minimal position change)
   */
  private gentlyCameraAdjust(node: VisualNode): void {
    const nodePos = node.mesh.position.clone();
    const currentTarget = this.controls.getTarget();

    // Only animate the look-at target towards the node
    const { lookAtBlendFactor } = config.layout.camera;
    const targetLookAt = currentTarget.clone().lerp(nodePos, lookAtBlendFactor);

    // Start camera animation (only adjusting look-at, not position)
    this.cameraAnimating = true;
    this.cameraAnimStart = Date.now();
    this.cameraStartPos.copy(this.scene.camera.position);
    this.cameraTargetPos.copy(this.scene.camera.position); // Keep same position
    this.cameraStartLookAt.copy(currentTarget);
    this.cameraTargetLookAt.copy(targetLookAt);
  }

  /**
   * Clear current selection
   */
  public clearSelection(): void {
    if (this.selectedNode) {
      this.selectedNode.mesh.material = this.selectedNode.originalMaterial;
      this.restoreNodeScale(this.selectedNode);
      this.selectedNode = null;
    }
    this.selectCallback?.(null);
  }

  /**
   * Set callback for selection changes
   */
  public onSelect(callback: (selection: SelectionInfo | null) => void): void {
    this.selectCallback = callback;
  }

  /**
   * Toggle a cluster's expanded state
   */
  public toggleCluster(clusterIndex: number): void {
    if (this.animating) return;

    const cluster = this.clusters[clusterIndex];
    if (!cluster) return;

    cluster.expanded = !cluster.expanded;
    this.animateLayout();
  }

  /**
   * Expand all clusters
   */
  public expandAll(): void {
    if (this.animating) return;
    this.clusters.forEach(c => c.expanded = true);
    this.animateLayout();
  }

  /**
   * Collapse all clusters
   */
  public collapseAll(): void {
    if (this.animating) return;
    this.clusters.forEach(c => c.expanded = false);
    this.animateLayout();
  }

  /**
   * Load a conversation from JSON/JSONL string
   */
  public loadJSON(content: string): void {
    // First try as JSONL (Claude Code format)
    if (claudeCodeParser.canParse(content)) {
      this.conversation = claudeCodeParser.parse(content);
      this.buildVisualization();
      this.updateStats();
      return;
    }

    // Fall back to JSON parsing
    try {
      const data = JSON.parse(content);
      this.loadData(data);
    } catch (error) {
      throw new Error(`Failed to parse file: ${error}`);
    }
  }

  /**
   * Load a conversation from parsed data
   */
  public loadData(data: unknown): void {
    // Try to parse with Claude Code parser
    if (claudeCodeParser.canParse(data)) {
      this.conversation = claudeCodeParser.parse(data);
    } else {
      throw new Error('Unsupported conversation format');
    }

    this.buildVisualization();
    this.updateStats();
  }

  /**
   * Build clusters from turns using the cluster-builder module
   */
  private buildClusters(): void {
    this.clusters = buildClustersFromConversation(this.conversation);
  }

  /**
   * Build the 3D visualization from the loaded conversation
   */
  private buildVisualization(): void {
    if (!this.conversation) return;

    // Clear existing nodes and selection
    this.clearSelection();
    this.clearNodes();

    // Build cluster structure
    this.buildClusters();

    // Create nodes for each cluster and its contents
    for (const cluster of this.clusters) {
      // Create cluster node (collapsed representation)
      const clusterNode = this.createClusterNode(cluster);
      this.nodes.push(clusterNode);
      this.scene.add(clusterNode.mesh);

      // Create child nodes (hidden initially)
      if (cluster.userTurn && cluster.userTurnIndex !== undefined) {
        const userNode = this.createNode('user', cluster.userTurn, cluster.userTurnIndex, cluster.index);
        userNode.mesh.visible = false;
        userNode.mesh.scale.setScalar(0.01);
        this.nodes.push(userNode);
        this.scene.add(userNode.mesh);
      }

      if (cluster.assistantTurn && cluster.assistantTurnIndex !== undefined) {
        const assistantNode = this.createNode('assistant', cluster.assistantTurn, cluster.assistantTurnIndex, cluster.index);
        assistantNode.mesh.visible = false;
        assistantNode.mesh.scale.setScalar(0.01);
        this.nodes.push(assistantNode);
        this.scene.add(assistantNode.mesh);

        // Create thinking and tool nodes
        for (const block of cluster.assistantTurn.content) {
          if (block.type === 'thinking') {
            const thinkingNode = this.createNode('thinking', block, cluster.assistantTurnIndex, cluster.index);
            thinkingNode.mesh.visible = false;
            thinkingNode.mesh.scale.setScalar(0.01);
            this.nodes.push(thinkingNode);
            this.scene.add(thinkingNode.mesh);
          } else if (block.type === 'tool_use') {
            const toolNode = this.createNode('tool_use', block, cluster.assistantTurnIndex, cluster.index);
            toolNode.mesh.visible = false;
            toolNode.mesh.scale.setScalar(0.01);
            this.nodes.push(toolNode);
            this.scene.add(toolNode.mesh);
          } else if (block.type === 'tool_result') {
            const resultNode = this.createNode('tool_result', block, cluster.assistantTurnIndex, cluster.index);
            resultNode.mesh.visible = false;
            resultNode.mesh.scale.setScalar(0.01);
            this.nodes.push(resultNode);
            this.scene.add(resultNode.mesh);
          } else if (block.type === 'image' || block.type === 'document') {
            const docNode = this.createNode('document', block, cluster.assistantTurnIndex, cluster.index);
            docNode.mesh.visible = false;
            docNode.mesh.scale.setScalar(0.01);
            this.nodes.push(docNode);
            this.scene.add(docNode.mesh);
          }
        }
      }

      // Create document nodes from user turn (images, PDFs, etc.)
      if (cluster.userTurn && cluster.userTurnIndex !== undefined) {
        for (const block of cluster.userTurn.content) {
          if (block.type === 'image' || block.type === 'document') {
            const docNode = this.createNode('document', block, cluster.userTurnIndex, cluster.index);
            docNode.mesh.visible = false;
            docNode.mesh.scale.setScalar(0.01);
            this.nodes.push(docNode);
            this.scene.add(docNode.mesh);
          }
        }
      }
    }

    // Set initial focus to middle of conversation
    this.focusClusterIndex = Math.floor(this.clusters.length / 2);

    // Apply initial layout
    this.applyLayout(false);
    this.updateConnectionLines();
    this.fitCamera();
  }

  /**
   * Create a cluster node
   */
  private createClusterNode(cluster: TurnCluster): VisualNode {
    // Size based on content from config
    const { clusterBase, clusterMaxBonus, clusterSegments } = config.layout.nodeSize;
    const sizeBonus = Math.min(clusterMaxBonus, (cluster.thinkingCount + cluster.toolCount) * 0.1);
    const size = clusterBase + sizeBonus;

    const geometry = new THREE.SphereGeometry(size, clusterSegments, clusterSegments);

    // Select material based on cluster properties
    let material: THREE.MeshStandardMaterial;
    if (cluster.hasError) {
      material = this.errorMaterial;
    } else if (cluster.isSidechain) {
      material = this.sidechainMaterial;
    } else {
      material = this.materials.cluster;
    }

    const mesh = new THREE.Mesh(geometry, material);

    return {
      mesh,
      type: 'cluster',
      data: cluster,
      turnIndex: cluster.userTurnIndex ?? cluster.assistantTurnIndex ?? 0,
      clusterIndex: cluster.index,
      originalMaterial: material,
    };
  }

  /**
   * Create a visual node
   */
  private createNode(type: NodeType, data: Turn | ContentBlock, turnIndex: number, clusterIndex?: number): VisualNode {
    const geometry = this.getGeometryForType(type);
    const material = this.materials[type];
    const mesh = new THREE.Mesh(geometry, material);

    return { mesh, type, data, turnIndex, clusterIndex, originalMaterial: material };
  }

  /**
   * Get geometry for a node type
   */
  private getGeometryForType(type: NodeType): THREE.BufferGeometry {
    const { nodeSize } = config.layout;
    switch (type) {
      case 'user':
        return new THREE.BoxGeometry(...nodeSize.user);
      case 'assistant':
        return new THREE.BoxGeometry(...nodeSize.assistant);
      case 'thinking':
        return new THREE.SphereGeometry(nodeSize.thinkingRadius, nodeSize.thinkingSegments, nodeSize.thinkingSegments);
      case 'tool_use':
        return new THREE.ConeGeometry(nodeSize.toolUseRadius, nodeSize.toolUseHeight, nodeSize.toolUseSegments);
      case 'tool_result':
        return new THREE.OctahedronGeometry(nodeSize.toolResultSize);
      case 'cluster':
        return new THREE.SphereGeometry(nodeSize.clusterBase, nodeSize.clusterSegments, nodeSize.clusterSegments);
      default:
        return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    }
  }

  /**
   * Get the current coil layout params from instance properties
   */
  private getLayoutParams(): CoilLayoutParams {
    return {
      radius: this.radius,
      angleStep: this.angleStep,
      verticalStep: this.verticalStep,
      tiltAngle: this.tiltAngle,
      radiusGrowth: this.radiusGrowth,
      focusIndex: this.focusClusterIndex,
      minVerticalSpacing: this.minVerticalSpacing,
      maxVerticalSpacing: this.maxVerticalSpacing,
      focusRadius: this.focusRadius,
    };
  }

  /**
   * Calculate spiral position for a cluster using the layout module
   */
  private getSpiralPosition(index: number): THREE.Vector3 {
    const pos = getLayoutPosition(index, this.getLayoutParams());
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  /**
   * Update focus and re-layout
   */
  private setFocus(clusterIndex: number): void {
    if (clusterIndex === this.focusClusterIndex) return;
    this.focusClusterIndex = Math.max(0, Math.min(clusterIndex, this.clusters.length - 1));
    this.animateLayout();
  }

  /**
   * Apply layout to all nodes
   */
  private applyLayout(animate: boolean): void {
    for (const cluster of this.clusters) {
      const clusterPos = this.getSpiralPosition(cluster.index);
      const clusterNode = this.nodes.find(n => n.type === 'cluster' && (n.data as TurnCluster).index === cluster.index);

      if (!clusterNode) continue;

      if (cluster.expanded) {
        // Hide cluster node
        clusterNode.targetScale = 0.01;
        clusterNode.targetPosition = clusterPos.clone();

        // Position child nodes
        let offsetY = 0;
        const childNodes = this.nodes.filter(n => n.clusterIndex === cluster.index && n.type !== 'cluster');

        // Radial direction from helix center for angled descent
        const radLen = Math.sqrt(clusterPos.x * clusterPos.x + clusterPos.z * clusterPos.z);
        const radX = radLen > 0 ? clusterPos.x / radLen : 1;
        const radZ = radLen > 0 ? clusterPos.z / radLen : 0;
        const cosD = Math.cos(this.descendAngle);
        const sinD = Math.sin(this.descendAngle);

        for (const node of childNodes) {
          node.mesh.visible = true;

          const pos = clusterPos.clone();
          // Descend at an angle: vertical + radial outward component
          const dist = -offsetY; // positive distance from cluster origin
          pos.y -= dist * cosD;
          pos.x += dist * sinD * radX;
          pos.z += dist * sinD * radZ;

          // Offset different types using config
          const { thinkingOffset, toolUseOffset, toolResultOffset } = config.layout.expanded;
          if (node.type === 'thinking') {
            pos.x += thinkingOffset[0];
            pos.z += thinkingOffset[1];
          } else if (node.type === 'tool_use') {
            pos.x += toolUseOffset[0];
            pos.z += toolUseOffset[1];
          } else if (node.type === 'tool_result') {
            pos.x += toolResultOffset[0];
            pos.z += toolResultOffset[1];
          }

          node.targetPosition = pos;
          node.targetScale = 1;

          if (node.type === 'user' || node.type === 'assistant') {
            offsetY -= this.expandedSpacing;
          } else {
            offsetY -= this.blockSpacing;
          }
        }
      } else {
        // Show cluster node
        clusterNode.targetPosition = clusterPos;
        clusterNode.targetScale = 1;

        // Hide child nodes
        const childNodes = this.nodes.filter(n => n.clusterIndex === cluster.index && n.type !== 'cluster');
        for (const node of childNodes) {
          node.targetPosition = clusterPos.clone();
          node.targetScale = 0.01;
        }
      }
    }

    if (animate) {
      this.startAnimation();
    } else {
      // Apply immediately
      const threshold = config.layout.selection.visibilityThreshold;
      for (const node of this.nodes) {
        if (node.targetPosition) {
          node.mesh.position.copy(node.targetPosition);
        }
        if (node.targetScale !== undefined) {
          node.mesh.scale.setScalar(node.targetScale);
          node.mesh.visible = node.targetScale > threshold;
        }
      }
    }
  }

  /**
   * Start layout animation
   */
  private startAnimation(): void {
    this.animating = true;
    this.animationStart = Date.now();
    this.animatingNodes = this.nodes.filter(n => n.targetPosition || n.targetScale !== undefined);

    // Store starting positions
    for (const node of this.animatingNodes) {
      (node as any).startPosition = node.mesh.position.clone();
      (node as any).startScale = node.mesh.scale.x;
    }
  }

  /**
   * Update animation frame
   */
  private updateAnimation(_deltaTime: number): void {
    const animationDuration = config.timing.animation.layoutTransition;

    // Layout animation
    if (this.animating) {
      const elapsed = Date.now() - this.animationStart;
      const progress = Math.min(1, elapsed / animationDuration);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      for (const node of this.animatingNodes) {
        const startPos = (node as any).startPosition as THREE.Vector3;
        const startScale = (node as any).startScale as number;

        if (node.targetPosition && startPos) {
          node.mesh.position.lerpVectors(startPos, node.targetPosition, eased);
        }

        if (node.targetScale !== undefined && startScale !== undefined) {
          const newScale = startScale + (node.targetScale - startScale) * eased;
          node.mesh.scale.setScalar(newScale);
          node.mesh.visible = newScale > config.layout.selection.visibilityThreshold;
        }
      }

      // Update connection lines during animation
      this.updateConnectionLines();

      if (progress >= 1) {
        this.animating = false;
        this.animatingNodes = [];

        // If selected node became invisible, select the cluster instead
        if (this.selectedNode && !this.selectedNode.mesh.visible) {
          const clusterNode = this.nodes.find(
            n => n.type === 'cluster' && n.clusterIndex === this.selectedNode?.clusterIndex
          );
          if (clusterNode) {
            this.selectNode(clusterNode);
          }
        }
      }
    }

    // Camera animation
    if (this.cameraAnimating) {
      const cameraAnimDuration = config.timing.animation.cameraTransition;
      const elapsed = Date.now() - this.cameraAnimStart;
      const progress = Math.min(1, elapsed / cameraAnimDuration);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate camera position
      this.scene.camera.position.lerpVectors(this.cameraStartPos, this.cameraTargetPos, eased);

      // Interpolate look-at target
      const currentLookAt = new THREE.Vector3().lerpVectors(
        this.cameraStartLookAt,
        this.cameraTargetLookAt,
        eased
      );
      this.controls.setTarget(currentLookAt.x, currentLookAt.y, currentLookAt.z);

      if (progress >= 1) {
        this.cameraAnimating = false;
      }
    }
  }

  /**
   * Update periodic callback timer
   */
  private updatePeriodicCallback(deltaTime: number): void {
    if (!this.periodicCallback) return;

    this.timeSincePeriodicCallback += deltaTime;
    if (this.timeSincePeriodicCallback >= this.periodicIntervalSeconds) {
      this.periodicCallback();
      this.timeSincePeriodicCallback = 0;
    }
  }

  /**
   * Register a callback to be called periodically from the render loop.
   * This is useful for tasks like autosaving UI state.
   * @param callback Function to call periodically
   * @param intervalSeconds How often to call (default 30 seconds)
   */
  public onPeriodicTick(callback: () => void, intervalSeconds = 30): void {
    this.periodicCallback = callback;
    this.periodicIntervalSeconds = intervalSeconds;
    this.timeSincePeriodicCallback = 0;
  }

  /**
   * Animate to new layout positions
   */
  private animateLayout(): void {
    this.applyLayout(true);
  }

  /**
   * Update connection lines between nodes in expanded clusters
   */
  private updateConnectionLines(): void {
    // Remove existing lines
    for (const line of this.connectionLines) {
      this.scene.remove(line);
    }
    for (const geom of this.connectionLineGeometries) {
      geom.dispose();
    }
    this.connectionLines = [];
    this.connectionLineGeometries = [];

    // Remove existing cluster line
    if (this.clusterLine) {
      this.scene.remove(this.clusterLine);
      this.clusterLine = null;
    }
    if (this.clusterLineGeometry) {
      this.clusterLineGeometry.dispose();
      this.clusterLineGeometry = null;
    }

    // Create lines for each expanded cluster
    for (const cluster of this.clusters) {
      if (!cluster.expanded) continue;

      // Get all visible nodes in this cluster in order
      const clusterNodes = this.nodes.filter(
        n => n.clusterIndex === cluster.index && n.type !== 'cluster' && n.mesh.visible
      );

      if (clusterNodes.length < 2) continue;

      // Sort by Y position (top to bottom)
      clusterNodes.sort((a, b) => b.mesh.position.y - a.mesh.position.y);

      // Create line connecting all nodes using Line2
      const positions: number[] = [];
      for (const node of clusterNodes) {
        positions.push(node.mesh.position.x, node.mesh.position.y, node.mesh.position.z);
      }

      const geometry = new LineGeometry();
      geometry.setPositions(positions);
      this.connectionLineGeometries.push(geometry);

      const line = new Line2(geometry, this.lineMaterial);
      line.computeLineDistances();
      this.scene.add(line);
      this.connectionLines.push(line);
    }

    // Create line connecting all cluster nodes if enabled
    if (this.showClusterLines && this.clusters.length > 1) {
      const positions: number[] = [];

      for (const cluster of this.clusters) {
        // Find the visible node for this cluster (either cluster node or first child if expanded)
        let node: VisualNode | undefined;

        if (cluster.expanded) {
          // Use the first visible child node
          node = this.nodes.find(
            n => n.clusterIndex === cluster.index && n.type !== 'cluster' && n.mesh.visible
          );
        } else {
          // Use the cluster node
          node = this.nodes.find(
            n => n.type === 'cluster' && (n.data as TurnCluster).index === cluster.index && n.mesh.visible
          );
        }

        if (node) {
          positions.push(node.mesh.position.x, node.mesh.position.y, node.mesh.position.z);
        }
      }

      if (positions.length >= 6) { // At least 2 points (6 values)
        // Create new LineGeometry
        const geometry = new LineGeometry();
        geometry.setPositions(positions);
        this.clusterLineGeometry = geometry;

        // Create Line2
        this.clusterLine = new Line2(geometry, this.clusterLineMaterial);
        this.clusterLine.computeLineDistances();
        this.scene.add(this.clusterLine);
      }
    }
  }

  /**
   * Clear all nodes from the scene
   */
  private clearNodes(): void {
    for (const node of this.nodes) {
      this.scene.remove(node.mesh);
      node.mesh.geometry.dispose();
    }
    this.nodes = [];

    // Also clear connection lines
    for (const line of this.connectionLines) {
      this.scene.remove(line);
    }
    for (const geom of this.connectionLineGeometries) {
      geom.dispose();
    }
    this.connectionLines = [];
    this.connectionLineGeometries = [];
  }

  /**
   * Fit camera to show all nodes
   */
  private fitCamera(): void {
    if (this.nodes.length === 0) return;

    const visibleNodes = this.nodes.filter(n => n.mesh.visible);
    if (visibleNodes.length === 0) return;

    const box = new THREE.Box3();
    for (const node of visibleNodes) {
      box.expandByObject(node.mesh);
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const [offsetX, offsetY, offsetZ] = config.layout.camera.fitViewOffset;

    this.controls.setTarget(center.x, center.y, center.z);
    this.scene.camera.position.set(
      center.x + maxDim * offsetX,
      center.y + maxDim * offsetY,
      center.z + maxDim * offsetZ
    );
  }

  /**
   * Calculate and report stats
   */
  private updateStats(): void {
    if (!this.conversation || !this.statsCallback) return;

    let thinkingBlocks = 0;
    let toolCalls = 0;

    for (const turn of this.conversation.turns) {
      for (const block of turn.content) {
        if (block.type === 'thinking') thinkingBlocks++;
        if (block.type === 'tool_use') toolCalls++;
      }
    }

    const totalTokens =
      (this.conversation.meta.total_usage?.input_tokens || 0) +
      (this.conversation.meta.total_usage?.output_tokens || 0);

    this.statsCallback({
      turns: this.conversation.turns.length,
      thinkingBlocks,
      toolCalls,
      totalTokens,
    });
  }

  /**
   * Set a callback for stats updates
   */
  public onStats(callback: (stats: ViewerStats) => void): void {
    this.statsCallback = callback;
    if (this.conversation) {
      this.updateStats();
    }
  }

  /**
   * Get the current conversation
   */
  public getConversation(): Conversation | null {
    return this.conversation;
  }

  /**
   * Get the number of clusters
   */
  public getClusterCount(): number {
    return this.clusters.length;
  }

  /**
   * Metrics available per cluster using the cluster-builder module
   */
  public getClusterMetrics(): Array<{
    index: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    thinkingCount: number;
    toolCount: number;
    contentLength: number;
  }> {
    return calculateClusterMetrics(this.clusters);
  }

  /**
   * Get the current focus cluster index
   */
  public getFocusIndex(): number {
    return this.focusClusterIndex;
  }

  /**
   * Get searchable content for all clusters using the cluster-builder module
   */
  public getSearchableContent(): Array<{
    clusterIndex: number;
    userText: string;
    assistantText: string;
    thinkingBlocks: string[];
    toolUses: Array<{ name: string; input: string }>;
    toolResults: Array<{ content: string; isError: boolean }>;
    documents: Array<{ mediaType: string; sourceType: 'url' | 'base64' | 'file'; size?: number; title?: string }>;
  }> {
    return extractSearchableContent(this.clusters);
  }

  /**
   * Select a cluster by index
   */
  public selectClusterByIndex(index: number): void {
    if (index < 0 || index >= this.clusters.length) return;

    // Find the cluster node
    const clusterNode = this.nodes.find(
      n => n.type === 'cluster' && (n.data as TurnCluster).index === index
    );

    if (clusterNode && clusterNode.mesh.visible) {
      this.selectNode(clusterNode);
    } else {
      // If cluster is expanded, find a visible child node
      const childNode = this.nodes.find(
        n => n.clusterIndex === index && n.type !== 'cluster' && n.mesh.visible
      );
      if (childNode) {
        this.selectNode(childNode);
      }
    }
  }

  /**
   * Focus camera on a specific cluster, centering it in view
   */
  public focusOnCluster(index: number): void {
    if (index < 0 || index >= this.clusters.length) return;

    // Find the cluster node or a visible child
    let targetNode = this.nodes.find(
      n => n.type === 'cluster' && (n.data as TurnCluster).index === index && n.mesh.visible
    );

    if (!targetNode) {
      targetNode = this.nodes.find(
        n => n.clusterIndex === index && n.mesh.visible
      );
    }

    if (!targetNode) return;

    const nodePos = targetNode.mesh.position.clone();

    // Calculate camera position to look at node from a good angle
    const cameraOffset = new THREE.Vector3(8, 4, 8);
    const newCameraPos = nodePos.clone().add(cameraOffset);

    // Start camera animation
    this.cameraAnimating = true;
    this.cameraAnimStart = Date.now();
    this.cameraStartPos.copy(this.scene.camera.position);
    this.cameraTargetPos.copy(newCameraPos);
    this.cameraStartLookAt.copy(this.controls.getTarget());
    this.cameraTargetLookAt.copy(nodePos);
  }

  /**
   * Highlight clusters containing a specific word
   * Returns the indices of clusters that were highlighted
   */
  public highlightClustersWithWord(word: string, color: number): number[] {
    const matchingIndices: number[] = [];
    const lowerWord = word.toLowerCase();

    // Find clusters containing the word
    for (const cluster of this.clusters) {
      let found = false;

      // Check user text
      if (cluster.userTurn) {
        for (const block of cluster.userTurn.content) {
          if (block.type === 'text' && block.text.toLowerCase().includes(lowerWord)) {
            found = true;
            break;
          }
        }
      }

      // Check assistant text and thinking
      if (!found && cluster.assistantTurn) {
        for (const block of cluster.assistantTurn.content) {
          if (block.type === 'text' && block.text.toLowerCase().includes(lowerWord)) {
            found = true;
            break;
          }
          if (block.type === 'thinking' && block.thinking.toLowerCase().includes(lowerWord)) {
            found = true;
            break;
          }
        }
      }

      if (found) {
        matchingIndices.push(cluster.index);
        this.highlightCluster(cluster.index, color);
      }
    }

    return matchingIndices;
  }

  /**
   * Highlight a specific cluster with a color
   */
  public highlightCluster(clusterIndex: number, color: number): void {
    const clusterNode = this.nodes.find(
      n => n.type === 'cluster' && (n.data as TurnCluster).index === clusterIndex
    );

    if (clusterNode && !this.highlightedClusters.has(clusterIndex)) {
      // Store original material
      this.highlightedClusters.set(clusterIndex, clusterNode.mesh.material as THREE.Material);
      this.clusterHighlightColors.set(clusterIndex, color);

      // Apply highlight material
      const highlightMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        emissive: color,
        emissiveIntensity: 0.3,
      });
      clusterNode.mesh.material = highlightMat;
    }
  }

  /**
   * Remove highlight from clusters that match a color
   */
  public unhighlightClustersByColor(color: number): void {
    const toRemove: number[] = [];

    for (const [clusterIndex, highlightColor] of this.clusterHighlightColors) {
      if (highlightColor === color) {
        toRemove.push(clusterIndex);
      }
    }

    for (const clusterIndex of toRemove) {
      this.unhighlightCluster(clusterIndex);
    }
  }

  /**
   * Remove highlight from a specific cluster
   */
  public unhighlightCluster(clusterIndex: number): void {
    const clusterNode = this.nodes.find(
      n => n.type === 'cluster' && (n.data as TurnCluster).index === clusterIndex
    );

    const originalMaterial = this.highlightedClusters.get(clusterIndex);
    if (clusterNode && originalMaterial) {
      // Dispose highlight material
      if (clusterNode.mesh.material !== originalMaterial) {
        (clusterNode.mesh.material as THREE.Material).dispose();
      }
      // Restore original
      clusterNode.mesh.material = originalMaterial;
      this.highlightedClusters.delete(clusterIndex);
      this.clusterHighlightColors.delete(clusterIndex);
    }
  }

  /**
   * Clear all word highlights
   */
  public clearAllHighlights(): void {
    for (const clusterIndex of Array.from(this.highlightedClusters.keys())) {
      this.unhighlightCluster(clusterIndex);
    }
  }

  /**
   * Get currently highlighted cluster indices
   */
  public getHighlightedClusters(): number[] {
    return Array.from(this.highlightedClusters.keys());
  }

  /**
   * Set search filter to show only specific clusters
   * Pass null to clear the filter and show all clusters
   */
  public setSearchFilter(clusterIndices: number[] | null): void {
    if (clusterIndices === null || clusterIndices.length === 0) {
      // Clear filter - show all
      this.searchFilterClusters = null;
      for (const node of this.nodes) {
        node.mesh.visible = true;
      }
    } else {
      // Apply filter
      this.searchFilterClusters = new Set(clusterIndices);
      for (const node of this.nodes) {
        // Show node if its cluster is in the filter set
        node.mesh.visible = node.clusterIndex !== undefined && this.searchFilterClusters.has(node.clusterIndex);
      }
    }
  }

  /**
   * Get current search filter cluster indices
   */
  public getSearchFilter(): number[] | null {
    return this.searchFilterClusters ? Array.from(this.searchFilterClusters) : null;
  }

  /**
   * Get current camera state for persistence
   */
  public getCameraState(): { position: [number, number, number]; target: [number, number, number] } {
    const pos = this.scene.camera.position;
    const target = this.controls.getTarget();
    return {
      position: [pos.x, pos.y, pos.z],
      target: [target.x, target.y, target.z],
    };
  }

  /**
   * Set camera state from persisted data
   */
  public setCameraState(position: [number, number, number], target: [number, number, number]): void {
    this.scene.camera.position.set(position[0], position[1], position[2]);
    this.controls.setTarget(target[0], target[1], target[2]);
  }

  /**
   * Set initial camera view looking down the spiral
   */
  public setInitialView(): void {
    // Position camera above and to the side, looking down at the spiral
    // The spiral descends in negative Y, so we look from above
    const clusterCount = this.clusters.length;
    const estimatedHeight = clusterCount * 0.5; // Rough estimate of vertical extent

    // Camera positioned at an angle, looking down
    this.scene.camera.position.set(12, 8, 12);
    this.controls.setTarget(0, -Math.min(estimatedHeight / 3, 10), 0);
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Remove event listeners first
    this.detachListeners();

    this.clearAllHighlights();
    this.clearNodes();
    Object.values(this.materials).forEach((m) => m.dispose());
    this.highlightMaterial.dispose();
    this.sidechainMaterial.dispose();
    this.errorMaterial.dispose();
    this.lineMaterial.dispose();
    this.clusterLineMaterial.dispose();
    if (this.clusterLineGeometry) {
      this.clusterLineGeometry.dispose();
    }
    this.controls.dispose();
    this.scene.dispose();
  }

  // ===== Coil parameter getters/setters =====

  /**
   * Get all coil parameters for UI binding
   */
  public getCoilParams(): {
    radius: number;
    angleStep: number;
    verticalStep: number;
    tiltAngle: number;
    radiusGrowth: number;
    descendAngle: number;
    focusRadius: number;
    minVerticalSpacing: number;
    maxVerticalSpacing: number;
  } {
    return {
      radius: this.radius,
      angleStep: this.angleStep,
      verticalStep: this.verticalStep,
      tiltAngle: this.tiltAngle,
      radiusGrowth: this.radiusGrowth,
      descendAngle: this.descendAngle,
      focusRadius: this.focusRadius,
      minVerticalSpacing: this.minVerticalSpacing,
      maxVerticalSpacing: this.maxVerticalSpacing,
    };
  }

  /**
   * Set a coil parameter and re-layout
   */
  public setCoilParam(name: string, value: number): void {
    switch (name) {
      case 'radius':
        this.radius = value;
        break;
      case 'angleStep':
        this.angleStep = value;
        break;
      case 'verticalStep':
        this.verticalStep = value;
        break;
      case 'tiltAngle':
        this.tiltAngle = value;
        break;
      case 'radiusGrowth':
        this.radiusGrowth = value;
        break;
      case 'descendAngle':
        this.descendAngle = value;
        break;
      case 'focusRadius':
        this.focusRadius = value;
        break;
      case 'minVerticalSpacing':
        this.minVerticalSpacing = value;
        break;
      case 'maxVerticalSpacing':
        this.maxVerticalSpacing = value;
        break;
      default:
        return;
    }
    this.animateLayout();
  }

  /**
   * Reset coil parameters to defaults
   */
  public resetCoilParams(): void {
    const { coil, focus } = config.layout;
    this.radius = coil.radius;
    this.angleStep = coil.angleStep;
    this.verticalStep = coil.verticalStep;
    this.tiltAngle = coil.tiltAngle;
    this.radiusGrowth = coil.radiusGrowth;
    this.descendAngle = config.layout.expanded.descendAngle;
    this.focusRadius = focus.focusRadius;
    this.minVerticalSpacing = focus.minVerticalSpacing;
    this.maxVerticalSpacing = focus.maxVerticalSpacing;
    this.animateLayout();
  }

  /**
   * Toggle cluster-to-cluster connection lines
   */
  public setShowClusterLines(show: boolean): void {
    this.showClusterLines = show;
    this.updateConnectionLines();
  }

  /**
   * Get current cluster lines visibility
   */
  public getShowClusterLines(): boolean {
    return this.showClusterLines;
  }

  /**
   * Set cluster line color
   */
  public setClusterLineColor(color: number): void {
    this.clusterLineMaterial.color.setHex(color);
  }

  /**
   * Get cluster line color as hex number
   */
  public getClusterLineColor(): number {
    return this.clusterLineMaterial.color.getHex();
  }

  /**
   * Set cluster line width in pixels
   */
  public setClusterLineWidth(width: number): void {
    this.clusterLineMaterial.linewidth = width;
  }

  /**
   * Get cluster line width
   */
  public getClusterLineWidth(): number {
    return this.clusterLineMaterial.linewidth;
  }

  /**
   * Set cluster line opacity
   */
  public setClusterLineOpacity(opacity: number): void {
    this.clusterLineMaterial.opacity = opacity;
  }

  /**
   * Get cluster line opacity
   */
  public getClusterLineOpacity(): number {
    return this.clusterLineMaterial.opacity;
  }
}
