import type { GameState, Vec } from '../types';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  /** Zoom que a câmera está perseguindo (a roda do mouse mexe nele). */
  zoomTarget: number;
  /** Visão geral do mapa inteiro (tecla M). */
  overview: boolean;
  /** Depois que a pessoa mexe no zoom, paramos de ajustá-lo sozinhos ao tamanho da tela. */
  userZoomed: boolean;
}

const DEFAULT_ZOOM = 1.35;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;
/** Zoom mínimo do ajuste automático (telefone deitado, ~390 px de altura). */
const MIN_AUTO_ZOOM = 0.75;
/** Altura de tela (px) a partir da qual o zoom padrão pode ser o máximo. */
const AUTO_ZOOM_REF_HEIGHT = 520;

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: DEFAULT_ZOOM, zoomTarget: DEFAULT_ZOOM, overview: false, userZoomed: false };
}

/**
 * Zoom padrão pra uma tela de altura `viewH`: telas pequenas (telefone deitado) afastam um pouco
 * pra enxergar mais do mapa. Em monitores comuns dá o mesmo `DEFAULT_ZOOM` de sempre.
 */
export function autoZoom(viewH: number): number {
  return Math.min(DEFAULT_ZOOM, Math.max(MIN_AUTO_ZOOM, viewH / AUTO_ZOOM_REF_HEIGHT));
}

/** Centraliza no jogador e sai da visão geral (início de partida). */
export function resetCamera(cam: Camera, focus: Vec): void {
  cam.x = focus.x;
  cam.y = focus.y;
  cam.overview = false;
}

/** Roda do mouse: aproxima (`deltaY` < 0) ou afasta. */
export function zoomBy(cam: Camera, deltaY: number): void {
  cam.overview = false;
  cam.userZoomed = true;
  cam.zoomTarget = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoomTarget * (deltaY < 0 ? 1.1 : 0.91)));
}

/** Suaviza a câmera em direção ao jogador, ou ao centro do mapa na visão geral. */
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

/** Converte um ponto da tela (px) em coordenadas do mundo. */
export function screenToWorld(cam: Camera, sx: number, sy: number, viewW: number, viewH: number): Vec {
  return { x: (sx - viewW / 2) / cam.zoom + cam.x, y: (sy - viewH / 2) / cam.zoom + cam.y };
}
