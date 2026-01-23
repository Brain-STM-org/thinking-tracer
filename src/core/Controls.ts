/**
 * Camera controls for scene navigation
 *
 * Implements orbit controls without external dependencies.
 * Can be replaced with three/addons OrbitControls if needed.
 */

import * as THREE from 'three';

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
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private enableDamping: boolean;
  private dampingFactor: number;
  private minDistance: number;
  private maxDistance: number;

  private target = new THREE.Vector3();
  private spherical = new THREE.Spherical();
  private sphericalDelta = new THREE.Spherical();
  private panOffset = new THREE.Vector3();
  private scale = 1;

  private rotateStart = new THREE.Vector2();
  private panStart = new THREE.Vector2();
  private isRotating = false;
  private isPanning = false;

  constructor(options: ControlsOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.enableDamping = options.enableDamping ?? true;
    this.dampingFactor = options.dampingFactor ?? 0.05;
    this.minDistance = options.minDistance ?? 1;
    this.maxDistance = options.maxDistance ?? 100;

    // Calculate initial spherical from camera position
    const offset = this.camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onMouseDown = (event: MouseEvent): void => {
    event.preventDefault();

    if (event.button === 0 && event.shiftKey) {
      // Shift+left click - pan (trackpad-friendly)
      this.isPanning = true;
      this.panStart.set(event.clientX, event.clientY);
    } else if (event.button === 0) {
      // Left click - rotate
      this.isRotating = true;
      this.rotateStart.set(event.clientX, event.clientY);
    } else if (event.button === 2) {
      // Right click - pan
      this.isPanning = true;
      this.panStart.set(event.clientX, event.clientY);
    }

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (this.isRotating) {
      const deltaX = event.clientX - this.rotateStart.x;
      const deltaY = event.clientY - this.rotateStart.y;

      const element = this.domElement;
      this.sphericalDelta.theta -= (2 * Math.PI * deltaX) / element.clientWidth;
      this.sphericalDelta.phi -= (2 * Math.PI * deltaY) / element.clientHeight;

      this.rotateStart.set(event.clientX, event.clientY);
    }

    if (this.isPanning) {
      const deltaX = event.clientX - this.panStart.x;
      const deltaY = event.clientY - this.panStart.y;

      // Ensure camera matrix is current
      this.camera.updateMatrixWorld();

      // Get distance from camera to target for scaling
      const distance = this.camera.position.distanceTo(this.target);

      // Scale pan speed based on distance and FOV
      const fovRad = (this.camera.fov * Math.PI) / 180;
      const panScale = (2 * distance * Math.tan(fovRad / 2)) / this.domElement.clientHeight;

      // Get camera's right and up vectors from world matrix
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      right.setFromMatrixColumn(this.camera.matrixWorld, 0);
      up.setFromMatrixColumn(this.camera.matrixWorld, 1);

      // Apply pan directly to target (no damping)
      this.target.addScaledVector(right, -deltaX * panScale);
      this.target.addScaledVector(up, deltaY * panScale);

      this.panStart.set(event.clientX, event.clientY);
    }
  };

  private onMouseUp = (): void => {
    this.isRotating = false;
    this.isPanning = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();

    if (event.deltaY < 0) {
      this.scale /= 0.95;
    } else if (event.deltaY > 0) {
      this.scale *= 0.95;
    }
  };

  /**
   * Update the controls - call this in your render loop
   */
  public update(): void {
    const offset = new THREE.Vector3();

    // Apply pan
    this.target.add(this.panOffset);

    // Get current position in spherical coordinates
    offset.copy(this.camera.position).sub(this.target);
    this.spherical.setFromVector3(offset);

    // Apply rotation delta
    if (this.enableDamping) {
      this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
      this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
    } else {
      this.spherical.theta += this.sphericalDelta.theta;
      this.spherical.phi += this.sphericalDelta.phi;
    }

    // Clamp phi to prevent flipping
    this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));

    // Apply zoom
    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

    // Convert back to cartesian
    offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);

    // Decay deltas
    if (this.enableDamping) {
      this.sphericalDelta.theta *= 1 - this.dampingFactor;
      this.sphericalDelta.phi *= 1 - this.dampingFactor;
      this.panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this.sphericalDelta.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
    }

    this.scale = 1;
  }

  /**
   * Set the target point to look at
   */
  public setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
  }

  /**
   * Get the current target point
   */
  public getTarget(): THREE.Vector3 {
    return this.target.clone();
  }

  /**
   * Dispose of event listeners
   */
  public dispose(): void {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}
