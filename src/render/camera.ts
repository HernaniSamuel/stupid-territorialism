import type { GameState, Vec } from '../types';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  /** The zoom the camera is chasing (the mouse wheel changes it). */
  zoomTarget: number;
  /** Overview of the whole map (M key). */
  overview: boolean;
  /** Once the person changes the zoom, we stop adjusting it automatically to the screen size. */
  userZoomed: boolean;
}

const DEFAULT_ZOOM = 1.35;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;
/** Minimum zoom for automatic adjustment (phone in landscape, ~390 px tall). */
const MIN_AUTO_ZOOM = 0.75;
/** Screen height (px) from which the default zoom can be the maximum. */
const AUTO_ZOOM_REF_HEIGHT = 520;

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: DEFAULT_ZOOM, zoomTarget: DEFAULT_ZOOM, overview: false, userZoomed: false };
}

/**
 * Default zoom for a screen of height `viewH`: small screens (phone in landscape) zoom out a bit
 * to see more of the map. On regular monitors it gives the same `DEFAULT_ZOOM` as always.
 */
export function autoZoom(viewH: number): number {
  return Math.min(DEFAULT_ZOOM, Math.max(MIN_AUTO_ZOOM, viewH / AUTO_ZOOM_REF_HEIGHT));
}

/** Centers on the player and leaves the overview (start of a match). */
export function resetCamera(cam: Camera, focus: Vec): void {
  cam.x = focus.x;
  cam.y = focus.y;
  cam.overview = false;
}

/** Mouse wheel: zooms in (`deltaY` < 0) or out. */
export function zoomBy(cam: Camera, deltaY: number): void {
  cam.overview = false;
  cam.userZoomed = true;
  cam.zoomTarget = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoomTarget * (deltaY < 0 ? 1.1 : 0.91)));
}

/** Smooths the camera toward the player, or toward the map center in the overview. */
export function updateCamera(cam: Camera, state: GameState, dt: number, viewW: number, viewH: number): void {
  const { bounds } = state.world;
  if (!cam.userZoomed) cam.zoomTarget = autoZoom(viewH);
  const targetZoom = cam.overview ? Math.min(viewW / (bounds.w + 160), viewH / (bounds.h + 200)) : cam.zoomTarget;
  const tx = cam.overview ? bounds.cx : state.player.x;
  const ty = cam.overview ? bounds.cy : state.player.y;
  const k = Math.min(1, dt * 6);
  cam.zoom += (targetZoom - cam.zoom) * k;
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

/** Converts a screen point (px) into world coordinates. */
export function screenToWorld(cam: Camera, sx: number, sy: number, viewW: number, viewH: number): Vec {
  return { x: (sx - viewW / 2) / cam.zoom + cam.x, y: (sy - viewH / 2) / cam.zoom + cam.y };
}
