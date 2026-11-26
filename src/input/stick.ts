/** Virtual joystick math. Pure, no DOM, so it can be tested. */
import type { Vec } from '../types';

/** Fraction of the radius within which the thumb doesn't count as a direction yet (avoids jitter). */
export const STICK_DEADZONE = 0.28;

/**
 * Converts the thumb's displacement from the point where it landed into a unit direction,
 * the same as WASD (the game moves along streets, so only the direction matters, not the amount).
 * Inside the dead zone it returns (0, 0).
 */
export function stickDirection(dx: number, dy: number, radius: number, deadzone = STICK_DEADZONE): Vec {
  const mag = Math.hypot(dx, dy);
  if (mag < radius * deadzone || mag === 0) return { x: 0, y: 0 };
  return { x: dx / mag, y: dy / mag };
}

/** Clamps the displacement to the joystick radius (where to draw the knob). */
export function clampToRadius(dx: number, dy: number, radius: number): Vec {
  const mag = Math.hypot(dx, dy);
  if (mag <= radius) return { x: dx, y: dy };
  return { x: (dx / mag) * radius, y: (dy / mag) * radius };
}
