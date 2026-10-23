import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface ProcessedImage {
  uri: string;
  width: number;
  height: number;
}

export interface ImageProcessor {
  /**
   * Re-encodes as JPEG at `quality` (0–1), shrinking so the longest edge is at most
   * `maxEdge` (never upscaling). Re-encoding drops EXIF metadata (e.g. location).
   */
  toJpeg(sourceUri: string, maxEdge: number, quality: number): Promise<ProcessedImage>;
}

export const deviceImages: ImageProcessor = {
  async toJpeg(sourceUri, maxEdge, quality) {
    const original = await ImageManipulator.manipulate(sourceUri).renderAsync();
    let image = original;
    if (Math.max(original.width, original.height) > maxEdge) {
      const size = original.width >= original.height ? { width: maxEdge } : { height: maxEdge };
      image = await ImageManipulator.manipulate(original).resize(size).renderAsync();
    }
    const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  },
};
