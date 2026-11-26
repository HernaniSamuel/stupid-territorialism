/** Matemática do joystick virtual. Pura, sem DOM, pra poder ser testada. */
import type { Vec } from '../types';

/** Fração do raio dentro da qual o polegar ainda não conta como direção (evita tremor). */
export const STICK_DEADZONE = 0.28;

/**
 * Converte o deslocamento do polegar a partir do ponto onde ele pousou em uma direção unitária,
 * igual à do WASD (o jogo anda pelas ruas, então só importa pra onde, não o quanto).
 * Dentro da zona morta devolve (0, 0).
 */
export function stickDirection(dx: number, dy: number, radius: number, deadzone = STICK_DEADZONE): Vec {
  const mag = Math.hypot(dx, dy);
  if (mag < radius * deadzone || mag === 0) return { x: 0, y: 0 };
  return { x: dx / mag, y: dy / mag };
}

/** Limita o deslocamento ao raio do joystick (onde desenhar a bolinha). */
export function clampToRadius(dx: number, dy: number, radius: number): Vec {
  const mag = Math.hypot(dx, dy);
  if (mag <= radius) return { x: dx, y: dy };
  return { x: (dx / mag) * radius, y: (dy / mag) * radius };
}
