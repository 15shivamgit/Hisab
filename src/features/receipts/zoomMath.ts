// Pure maths for the receipt zoom (RCP-04). Marked as worklets so gesture callbacks can
// call them on the UI thread; in Jest they are ordinary functions.

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;

export function clampScale(scale: number): number {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * How far the scaled image may move from the centre along one axis so its edge never
 * leaves the screen edge. 0 when the scaled image still fits.
 */
export function maxOffset(contentSize: number, containerSize: number, scale: number): number {
  'worklet';
  return Math.max(0, (contentSize * scale - containerSize) / 2);
}

export function clampOffset(
  offset: number,
  contentSize: number,
  containerSize: number,
  scale: number,
): number {
  'worklet';
  const limit = maxOffset(contentSize, containerSize, scale);
  return Math.min(limit, Math.max(-limit, offset));
}

/** Fits an image of the given size inside a box, keeping its aspect ratio. */
export function fitInside(
  image: { width: number; height: number },
  box: { width: number; height: number },
): { width: number; height: number } {
  if (image.width <= 0 || image.height <= 0) return box;
  const ratio = Math.min(box.width / image.width, box.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
}
