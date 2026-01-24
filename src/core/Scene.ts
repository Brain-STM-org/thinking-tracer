/**
 * Three.js scene setup and management
 */

import * as THREE from 'three';
import {
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_THEME_CONFIG,
  DEFAULT_UI_CONFIG,
} from '../config';

// Config defaults
const layoutConfig = DEFAULT_LAYOUT_CONFIG;
const themeConfig = DEFAULT_THEME_CONFIG;
const uiConfig = DEFAULT_UI_CONFIG;

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
    const { container, background = themeConfig.scene.background } = options;
    this.container = container;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);

    // Create camera using config values
    const { fov, near, far, initialZ } = layoutConfig.camera;
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 0, initialZ);

    // Create renderer (WebGL for now, WebGPU support to be added)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    const { maxPixelRatio } = uiConfig.renderer;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Setup lighting
    this.setupLighting();

    // Handle resize
    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(container);
  }

  private setupLighting(): void {
    const {
      ambientLightColor,
      ambientLightIntensity,
      mainLightColor,
      mainLightIntensity,
      fillLightColor,
      fillLightIntensity,
    } = themeConfig.scene;

    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(ambientLightColor, ambientLightIntensity);
    this.scene.add(ambient);

    // Directional light for depth
    const directional = new THREE.DirectionalLight(mainLightColor, mainLightIntensity);
    directional.position.set(5, 10, 7);
    this.scene.add(directional);

    // Soft fill light from below
    const fill = new THREE.DirectionalLight(fillLightColor, fillLightIntensity);
    fill.position.set(-5, -5, 3);
    this.scene.add(fill);
  }

  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    // Render immediately to prevent flicker
    this.renderer.render(this.scene, this.camera);
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
