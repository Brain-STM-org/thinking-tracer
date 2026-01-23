/**
 * Main Viewer class - the primary API for thinking-tracer
 */

import * as THREE from 'three';
import { Scene, type SceneOptions } from './Scene';
import { Controls } from './Controls';
import type { Conversation, Turn, ContentBlock } from '../data/types';
import { claudeCodeParser } from '../data/parsers/claude-code';

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
type NodeType = 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result' | 'cluster';

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

/** A cluster of turns (user + assistant pair) */
interface TurnCluster {
  index: number;
  userTurn?: Turn;
  assistantTurn?: Turn;
  userTurnIndex?: number;
  assistantTurnIndex?: number;
  expanded: boolean;
  thinkingCount: number;
  toolCount: number;
}

/** Selection info passed to callback */
export interface SelectionInfo {
  type: NodeType;
  data: Turn | ContentBlock | TurnCluster;
  turnIndex: number;
  clusterIndex?: number;
}

// Animation duration in ms
const ANIMATION_DURATION = 400;

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

  // Selection scale
  private readonly selectedScale = 1.25; // 25% larger

  // Double-click detection
  private lastClickTime = 0;
  private lastClickedNode: VisualNode | null = null;

  // Materials for different node types
  private materials: Record<NodeType, THREE.MeshStandardMaterial>;
  private highlightMaterial: THREE.MeshStandardMaterial;

  // Layout parameters - primary spiral (tight coil)
  private readonly spiralRadius = 2.5;        // Radius of the tight spiral
  private readonly spiralAngleStep = Math.PI / 2.5; // Angle per cluster on tight spiral
  private readonly expandedSpacing = 2;
  private readonly blockSpacing = 1.2;

  // Secondary coil parameters (the path the spiral follows)
  private readonly coilRadius = 6;            // Radius of the larger coil path
  private readonly coilAngleStep = Math.PI / 8; // Slower rotation for the coil path
  private readonly coilVerticalStep = 1.5;    // Vertical rise per coil rotation

  // Slinky effect parameters
  private focusClusterIndex = 0;
  private readonly minVerticalSpacing = 0.2;  // Compressed spacing at ends
  private readonly maxVerticalSpacing = 1.5;  // Expanded spacing at focus
  private readonly focusRadius = 4;           // How many clusters around focus get expanded

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

    // Initialize materials
    this.materials = {
      user: new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: 0.5 }),
      assistant: new THREE.MeshStandardMaterial({ color: 0x50c878, roughness: 0.5 }),
      thinking: new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.3, transparent: true, opacity: 0.8 }),
      tool_use: new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.4 }),
      tool_result: new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 }),
      cluster: this.createClusterMaterial(),
    };

    // Highlight material for selected nodes
    this.highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      emissive: 0x444444,
    });

    // Setup click handler
    this.setupClickHandler();

    // Setup keyboard handler
    this.setupKeyboardHandler();

    // Start render loop
    this.scene.start((deltaTime) => {
      this.controls.update();
      this.updateAnimation(deltaTime);
    });
  }

  /**
   * Create gradient-like material for clusters
   */
  private createClusterMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x5a9a7a, // Blend of user blue and assistant green
      roughness: 0.3,
      metalness: 0.1,
    });
  }

  /**
   * Setup click detection for node selection
   */
  private setupClickHandler(): void {
    let mouseDownPos = { x: 0, y: 0 };
    let mouseDownTime = 0;

    this.scene.renderer.domElement.addEventListener('mousedown', (event) => {
      mouseDownPos = { x: event.clientX, y: event.clientY };
      mouseDownTime = Date.now();
    });

    this.scene.renderer.domElement.addEventListener('mouseup', (event) => {
      // Only count as click if mouse didn't move much and was quick
      const dx = event.clientX - mouseDownPos.x;
      const dy = event.clientY - mouseDownPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - mouseDownTime;

      if (dist < 5 && duration < 300) {
        this.handleClick(event);
      }
    });
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardHandler(): void {
    window.addEventListener('keydown', (event) => {
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
    });
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
    return this.nodes.filter(n => n.mesh.visible && n.mesh.scale.x > 0.01);
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
        const isDoubleClick = (now - this.lastClickTime < 400) && (this.lastClickedNode === node);

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
    node.mesh.scale.setScalar(originalScale * this.selectedScale);
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

    // Only animate the look-at target towards the node (blend 30% towards it)
    const targetLookAt = currentTarget.clone().lerp(nodePos, 0.3);

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
   * Build clusters from turns
   */
  private buildClusters(): void {
    this.clusters = [];

    if (!this.conversation) return;

    const { turns } = this.conversation;
    let clusterIndex = 0;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];

      if (turn.role === 'user') {
        // Start a new cluster with user turn
        const cluster: TurnCluster = {
          index: clusterIndex,
          userTurn: turn,
          userTurnIndex: i,
          expanded: false,
          thinkingCount: 0,
          toolCount: 0,
        };

        // Look for following assistant turn
        if (i + 1 < turns.length && turns[i + 1].role === 'assistant') {
          const assistantTurn = turns[i + 1];
          cluster.assistantTurn = assistantTurn;
          cluster.assistantTurnIndex = i + 1;

          // Count thinking and tool blocks
          for (const block of assistantTurn.content) {
            if (block.type === 'thinking') cluster.thinkingCount++;
            if (block.type === 'tool_use') cluster.toolCount++;
          }

          i++; // Skip the assistant turn in next iteration
        }

        this.clusters.push(cluster);
        clusterIndex++;
      } else if (turn.role === 'assistant' && this.clusters.length === 0) {
        // Orphan assistant turn at the start
        const cluster: TurnCluster = {
          index: clusterIndex,
          assistantTurn: turn,
          assistantTurnIndex: i,
          expanded: false,
          thinkingCount: 0,
          toolCount: 0,
        };

        for (const block of turn.content) {
          if (block.type === 'thinking') cluster.thinkingCount++;
          if (block.type === 'tool_use') cluster.toolCount++;
        }

        this.clusters.push(cluster);
        clusterIndex++;
      }
    }
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
          }
        }
      }
    }

    // Set initial focus to middle of conversation
    this.focusClusterIndex = Math.floor(this.clusters.length / 2);

    // Apply initial layout
    this.applyLayout(false);
    this.fitCamera();
  }

  /**
   * Create a cluster node
   */
  private createClusterNode(cluster: TurnCluster): VisualNode {
    // Size based on content
    const baseSize = 0.8;
    const sizeBonus = Math.min(0.5, (cluster.thinkingCount + cluster.toolCount) * 0.1);
    const size = baseSize + sizeBonus;

    const geometry = new THREE.SphereGeometry(size, 24, 24);
    const material = this.materials.cluster;
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
    switch (type) {
      case 'user':
        return new THREE.BoxGeometry(0.8, 0.8, 0.8);
      case 'assistant':
        return new THREE.BoxGeometry(1, 1, 1);
      case 'thinking':
        return new THREE.SphereGeometry(0.4, 16, 16);
      case 'tool_use':
        return new THREE.ConeGeometry(0.3, 0.6, 6);
      case 'tool_result':
        return new THREE.OctahedronGeometry(0.3);
      case 'cluster':
        return new THREE.SphereGeometry(0.8, 24, 24);
      default:
        return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    }
  }

  /**
   * Calculate vertical spacing for a cluster based on distance from focus
   * Uses a smooth falloff to create the "slinky" effect
   */
  private getVerticalSpacing(index: number): number {
    const distanceFromFocus = Math.abs(index - this.focusClusterIndex);

    if (distanceFromFocus >= this.focusRadius) {
      return this.minVerticalSpacing;
    }

    // Smooth cosine falloff from max at focus to min at edge
    const t = distanceFromFocus / this.focusRadius;
    const falloff = (Math.cos(t * Math.PI) + 1) / 2; // 1 at center, 0 at edge

    return this.minVerticalSpacing + (this.maxVerticalSpacing - this.minVerticalSpacing) * falloff;
  }

  /**
   * Calculate spiral position for a cluster with slinky effect and secondary coiling
   * Creates a "coiled coil" - a spiral that follows a larger helical path
   */
  private getSpiralPosition(index: number): THREE.Vector3 {
    // Calculate progress along the path (for secondary coil)
    let pathProgress = 0;
    for (let i = 0; i < index; i++) {
      pathProgress += this.getVerticalSpacing(i);
    }

    // Secondary coil (the larger path that the spiral center follows)
    const coilAngle = pathProgress * this.coilAngleStep;
    const coilCenterX = Math.cos(coilAngle) * this.coilRadius;
    const coilCenterZ = Math.sin(coilAngle) * this.coilRadius;
    const coilCenterY = pathProgress * this.coilVerticalStep;

    // Primary spiral (tight coil around the secondary coil path)
    const spiralAngle = index * this.spiralAngleStep;

    // Calculate the tangent direction of the coil path for proper orientation
    const tangentAngle = coilAngle + Math.PI / 2;
    const tangentX = Math.cos(tangentAngle);
    const tangentZ = Math.sin(tangentAngle);

    // Spiral offset perpendicular to the coil path
    // Use the tangent and up vector to create the spiral plane
    const spiralOffsetX = Math.cos(spiralAngle) * this.spiralRadius * tangentX;
    const spiralOffsetZ = Math.cos(spiralAngle) * this.spiralRadius * tangentZ;
    const spiralOffsetY = Math.sin(spiralAngle) * this.spiralRadius;

    return new THREE.Vector3(
      coilCenterX + spiralOffsetX,
      coilCenterY + spiralOffsetY,
      coilCenterZ + spiralOffsetZ
    );
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

        for (const node of childNodes) {
          node.mesh.visible = true;

          const pos = clusterPos.clone();
          pos.y += offsetY;

          // Offset different types
          if (node.type === 'thinking') {
            pos.x += 1;
            pos.z += 0.5;
          } else if (node.type === 'tool_use') {
            pos.x += 0.8;
            pos.z -= 0.5;
          } else if (node.type === 'tool_result') {
            pos.x += 1.2;
            pos.z -= 0.3;
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
      for (const node of this.nodes) {
        if (node.targetPosition) {
          node.mesh.position.copy(node.targetPosition);
        }
        if (node.targetScale !== undefined) {
          node.mesh.scale.setScalar(node.targetScale);
          node.mesh.visible = node.targetScale > 0.01;
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
    // Layout animation
    if (this.animating) {
      const elapsed = Date.now() - this.animationStart;
      const progress = Math.min(1, elapsed / ANIMATION_DURATION);

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
          node.mesh.visible = newScale > 0.01;
        }
      }

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
      const elapsed = Date.now() - this.cameraAnimStart;
      const progress = Math.min(1, elapsed / ANIMATION_DURATION);

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
   * Animate to new layout positions
   */
  private animateLayout(): void {
    this.applyLayout(true);
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

    this.controls.setTarget(center.x, center.y, center.z);
    this.scene.camera.position.set(
      center.x + maxDim * 0.8,
      center.y + maxDim * 0.5,
      center.z + maxDim * 1.2
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
   * Metrics available per cluster
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
    return this.clusters.map((cluster) => {
      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let contentLength = 0;

      // Get usage from assistant turn (that's where API reports tokens)
      if (cluster.assistantTurn?.usage) {
        const usage = cluster.assistantTurn.usage;
        inputTokens = usage.input_tokens || 0;
        outputTokens = usage.output_tokens || 0;
        totalTokens = inputTokens + outputTokens;
      }

      // Calculate content length
      if (cluster.userTurn) {
        for (const block of cluster.userTurn.content) {
          if (block.type === 'text') contentLength += block.text.length;
        }
      }
      if (cluster.assistantTurn) {
        for (const block of cluster.assistantTurn.content) {
          if (block.type === 'text') contentLength += block.text.length;
          if (block.type === 'thinking') contentLength += block.thinking.length;
        }
      }

      return {
        index: cluster.index,
        totalTokens,
        inputTokens,
        outputTokens,
        thinkingCount: cluster.thinkingCount,
        toolCount: cluster.toolCount,
        contentLength,
      };
    });
  }

  /**
   * Get the current focus cluster index
   */
  public getFocusIndex(): number {
    return this.focusClusterIndex;
  }

  /**
   * Get searchable content for all clusters
   * Returns array of clusters with their text content for searching
   */
  public getSearchableContent(): Array<{
    clusterIndex: number;
    userText: string;
    assistantText: string;
    thinkingBlocks: string[];
    toolUses: Array<{ name: string; input: string }>;
    toolResults: Array<{ content: string; isError: boolean }>;
  }> {
    return this.clusters.map((cluster) => {
      const result = {
        clusterIndex: cluster.index,
        userText: '',
        assistantText: '',
        thinkingBlocks: [] as string[],
        toolUses: [] as Array<{ name: string; input: string }>,
        toolResults: [] as Array<{ content: string; isError: boolean }>,
      };

      // Extract user text
      if (cluster.userTurn) {
        result.userText = cluster.userTurn.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n');
      }

      // Extract assistant content
      if (cluster.assistantTurn) {
        for (const block of cluster.assistantTurn.content) {
          if (block.type === 'text') {
            result.assistantText += (result.assistantText ? '\n' : '') + block.text;
          } else if (block.type === 'thinking') {
            result.thinkingBlocks.push(block.thinking);
          } else if (block.type === 'tool_use') {
            result.toolUses.push({
              name: block.name,
              input: JSON.stringify(block.input || {}),
            });
          } else if (block.type === 'tool_result') {
            // Handle both string and ContentBlock[] content types
            let contentStr = '';
            if (typeof block.content === 'string') {
              contentStr = block.content;
            } else if (Array.isArray(block.content)) {
              contentStr = block.content
                .filter(b => b.type === 'text')
                .map(b => (b as { text: string }).text)
                .join('\n');
            }
            result.toolResults.push({
              content: contentStr,
              isError: block.is_error || false,
            });
          }
        }
      }

      return result;
    });
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
   * Dispose of all resources
   */
  public dispose(): void {
    this.clearAllHighlights();
    this.clearNodes();
    Object.values(this.materials).forEach((m) => m.dispose());
    this.highlightMaterial.dispose();
    this.controls.dispose();
    this.scene.dispose();
  }
}
