/**
 * Three.js scene setup and management
 */

import * as THREE from 'three';

export interface SceneOptions {
  /** Container element for the canvas */
  container: HTMLElement;
  /** Background color */
  background?: number;
  /** Whether to use WebGPU renderer (falls back to WebGL if unavailable) */
  useWebGPU?: boolean;
}

export class Scene {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver;

  constructor(options: SceneOptions) {
    const { container, background = 0x1a1a2e } = options;
    this.container = container;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);

    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 10);

    // Create renderer (WebGL for now, WebGPU support to be added)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Setup lighting
    this.setupLighting();

    // Handle resize
    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(container);
  }

  private setupLighting(): void {
    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // Directional light for depth
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 7);
    this.scene.add(directional);

    // Soft fill light from below
    const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
    fill.position.set(-5, -5, 3);
    this.scene.add(fill);
  }

  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Start the render loop
   */
  public start(onFrame?: (deltaTime: number) => void): void {
    let lastTime = performance.now();

    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      onFrame?.(deltaTime);
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  /**
   * Stop the render loop
   */
  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Add an object to the scene
   */
  public add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  /**
   * Remove an object from the scene
   */
  public remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  /**
   * Clear all objects from the scene (except lights)
   */
  public clear(): void {
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Light) && object !== this.scene) {
        toRemove.push(object);
      }
    });
    toRemove.forEach((obj) => {
      if (obj.parent === this.scene) {
        this.scene.remove(obj);
      }
    });
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
