/**
 * Camera controls for scene navigation
 *
 * Thin wrapper around Three.js OrbitControls with WASD keyboard panning.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ControlsOptions {
  /** Camera to control */
  camera: THREE.PerspectiveCamera;
  /** DOM element to listen for events */
  domElement: HTMLElement;
  /** Enable damping for smooth movement */
  enableDamping?: boolean;
  /** Damping factor (0-1) */
  dampingFactor?: number;
  /** Minimum distance from target */
  minDistance?: number;
  /** Maximum distance from target */
  maxDistance?: number;
}

export class Controls {
  private orbit: OrbitControls;
  private camera: THREE.PerspectiveCamera;

  // WASD state
  private keysPressed = new Set<string>();
  private shiftHeld = false;
  private panSpeed = 0.5;

  // Bound handlers for cleanup
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor(options: ControlsOptions) {
    this.camera = options.camera;
    this.orbit = new OrbitControls(options.camera, options.domElement);
    this.orbit.enableDamping = options.enableDamping ?? true;
    this.orbit.dampingFactor = options.dampingFactor ?? 0.05;
    this.orbit.minDistance = options.minDistance ?? 1;
    this.orbit.maxDistance = options.maxDistance ?? 100;

    // Screen-space panning (not world-plane) for intuitive movement
    this.orbit.screenSpacePanning = true;

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === 'Shift') this.shiftHeld = true;
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      this.keysPressed.add(key);
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift') this.shiftHeld = false;
    this.keysPressed.delete(event.key.toLowerCase());
  }

  /**
   * Update the controls - call this in your render loop
   */
  public update(): void {
    // Apply WASD pan: move camera + target together in screen space
    if (this.keysPressed.size > 0) {
      this.camera.updateMatrixWorld();

      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      // Forward = negative Z column of camera world matrix
      const forward = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2).negate();

      // Scale speed by distance so movement feels consistent at any zoom
      const distance = this.camera.position.distanceTo(this.orbit.target);
      const speed = this.panSpeed * distance * 0.01;

      const delta = new THREE.Vector3();
      if (this.keysPressed.has('a')) delta.addScaledVector(right, -speed);
      if (this.keysPressed.has('d')) delta.addScaledVector(right, speed);
      if (this.shiftHeld) {
        // Shift+W/S: move forward/backward along look direction
        if (this.keysPressed.has('w')) delta.addScaledVector(forward, speed);
        if (this.keysPressed.has('s')) delta.addScaledVector(forward, -speed);
      } else {
        // W/S: pan up/down in screen space
        if (this.keysPressed.has('w')) delta.addScaledVector(up, speed);
        if (this.keysPressed.has('s')) delta.addScaledVector(up, -speed);
      }

      this.orbit.target.add(delta);
      this.camera.position.add(delta);
    }

    this.orbit.update();
  }

  /**
   * Set the target point to look at
   */
  public setTarget(x: number, y: number, z: number): void {
    this.orbit.target.set(x, y, z);
  }

  /**
   * Get the current target point
   */
  public getTarget(): THREE.Vector3 {
    return this.orbit.target.clone();
  }

  /**
   * Dispose of event listeners
   */
  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.orbit.dispose();
  }
}
