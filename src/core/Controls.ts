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

    if (event.button === 0) {
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

      const element = this.domElement;
      const offset = this.camera.position.clone().sub(this.target);
      let targetDistance = offset.length();
      targetDistance *= Math.tan(((this.camera.fov / 2) * Math.PI) / 180);

      // Pan left/right
      const panLeft = new THREE.Vector3();
      panLeft.setFromMatrixColumn(this.camera.matrix, 0);
      panLeft.multiplyScalar((-2 * deltaX * targetDistance) / element.clientHeight);
      this.panOffset.add(panLeft);

      // Pan up/down
      const panUp = new THREE.Vector3();
      panUp.setFromMatrixColumn(this.camera.matrix, 1);
      panUp.multiplyScalar((2 * deltaY * targetDistance) / element.clientHeight);
      this.panOffset.add(panUp);

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
   * Dispose of event listeners
   */
  public dispose(): void {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}
