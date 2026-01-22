/**
 * Main Viewer class - the primary API for thinking-trace-viewer
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
type NodeType = 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result';

/** Visual node in the scene */
interface VisualNode {
  mesh: THREE.Mesh;
  type: NodeType;
  data: Turn | ContentBlock;
  turnIndex: number;
}

export class Viewer {
  private scene: Scene;
  private controls: Controls;
  private conversation: Conversation | null = null;
  private nodes: VisualNode[] = [];
  private statsCallback?: (stats: ViewerStats) => void;

  // Materials for different node types
  private materials: Record<NodeType, THREE.Material>;

  constructor(options: ViewerOptions) {
    const container =
      typeof options.container === 'string'
        ? document.querySelector<HTMLElement>(options.container)
        : options.container;

    if (!container) {
      throw new Error('Container element not found');
    }

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
    };

    // Start render loop
    this.scene.start(() => {
      this.controls.update();
    });
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
   * Build the 3D visualization from the loaded conversation
   */
  private buildVisualization(): void {
    if (!this.conversation) return;

    // Clear existing nodes
    this.clearNodes();

    const { turns } = this.conversation;

    // Layout parameters
    const turnSpacing = 3;
    const blockSpacing = 1.5;
    const startX = -((turns.length - 1) * turnSpacing) / 2;

    turns.forEach((turn, turnIndex) => {
      const x = startX + turnIndex * turnSpacing;
      let y = 0;

      // Create main turn node
      const turnNode = this.createNode(
        turn.role === 'user' ? 'user' : 'assistant',
        turn,
        turnIndex
      );
      turnNode.mesh.position.set(x, y, 0);
      this.scene.add(turnNode.mesh);
      this.nodes.push(turnNode);

      // Create nodes for thinking blocks and tool calls
      turn.content.forEach((block) => {
        if (block.type === 'thinking') {
          y -= blockSpacing;
          const thinkingNode = this.createNode('thinking', block, turnIndex);
          thinkingNode.mesh.position.set(x, y, 1);
          thinkingNode.mesh.scale.setScalar(0.6);
          this.scene.add(thinkingNode.mesh);
          this.nodes.push(thinkingNode);
        } else if (block.type === 'tool_use') {
          y -= blockSpacing;
          const toolNode = this.createNode('tool_use', block, turnIndex);
          toolNode.mesh.position.set(x + 0.5, y, 0.5);
          toolNode.mesh.scale.setScalar(0.5);
          this.scene.add(toolNode.mesh);
          this.nodes.push(toolNode);
        } else if (block.type === 'tool_result') {
          const resultNode = this.createNode('tool_result', block, turnIndex);
          resultNode.mesh.position.set(x + 1, y, 0.5);
          resultNode.mesh.scale.setScalar(0.4);
          this.scene.add(resultNode.mesh);
          this.nodes.push(resultNode);
        }
      });
    });

    // Position camera to see all nodes
    this.fitCamera();
  }

  /**
   * Create a visual node
   */
  private createNode(type: NodeType, data: Turn | ContentBlock, turnIndex: number): VisualNode {
    const geometry = this.getGeometryForType(type);
    const material = this.materials[type];
    const mesh = new THREE.Mesh(geometry, material);

    return { mesh, type, data, turnIndex };
  }

  /**
   * Get geometry for a node type
   */
  private getGeometryForType(type: NodeType): THREE.BufferGeometry {
    switch (type) {
      case 'user':
        return new THREE.BoxGeometry(1, 1, 1);
      case 'assistant':
        return new THREE.BoxGeometry(1.2, 1.2, 1.2);
      case 'thinking':
        return new THREE.SphereGeometry(0.5, 16, 16);
      case 'tool_use':
        return new THREE.ConeGeometry(0.4, 0.8, 6);
      case 'tool_result':
        return new THREE.OctahedronGeometry(0.4);
      default:
        return new THREE.BoxGeometry(0.5, 0.5, 0.5);
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
  }

  /**
   * Fit camera to show all nodes
   */
  private fitCamera(): void {
    if (this.nodes.length === 0) return;

    const box = new THREE.Box3();
    for (const node of this.nodes) {
      box.expandByObject(node.mesh);
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    this.controls.setTarget(center.x, center.y, center.z);
    this.scene.camera.position.set(center.x, center.y, center.z + maxDim * 1.5);
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
   * Dispose of all resources
   */
  public dispose(): void {
    this.clearNodes();
    Object.values(this.materials).forEach((m) => m.dispose());
    this.controls.dispose();
    this.scene.dispose();
  }
}
