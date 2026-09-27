/**
 * Screen positions of graph nodes, published once per frame by the renderer so DOM annotations
 * can anchor to the geometry they describe without re-rendering React on every frame.
 */

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export const screenPositions: Record<string, ScreenPoint> = {};

export function publishScreenPoint(id: string, x: number, y: number, visible: boolean): void {
  const entry = screenPositions[id];
  if (entry) {
    entry.x = x;
    entry.y = y;
    entry.visible = visible;
  } else {
    screenPositions[id] = { x, y, visible };
  }
}
