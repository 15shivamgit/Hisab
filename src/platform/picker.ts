// Camera and gallery (expo-image-picker). The Android photo picker needs no storage
// permission; the camera asks for CAMERA the first time (SECURITY_AND_PRIVACY.md).

import * as ImagePicker from 'expo-image-picker';

import { runWithoutLock } from '@/platform/lockSession';

export interface PickedAsset {
  uri: string;
  mimeType?: string;
  fileName?: string | null;
  fileSize?: number;
  width: number;
  height: number;
}

export type PickResult =
  | { status: 'picked'; assets: PickedAsset[] }
  | { status: 'canceled' }
  | { status: 'denied'; canAskAgain: boolean };

function toResult(result: ImagePicker.ImagePickerResult): PickResult {
  if (result.canceled) return { status: 'canceled' };
  return {
    status: 'picked',
    assets: result.assets.map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType,
      fileName: a.fileName,
      fileSize: a.fileSize,
      width: a.width,
      height: a.height,
    })),
  };
}

export interface Picker {
  takePhoto(): Promise<PickResult>;
  chooseFromGallery(limit: number): Promise<PickResult>;
  /** Android may kill the app while the camera is open; the photo is recovered on restart. */
  pendingResult(): Promise<PickResult | null>;
}

export const devicePicker: Picker = {
  async takePhoto() {
    const permission = await runWithoutLock(() => ImagePicker.requestCameraPermissionsAsync());
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };
    // Full quality here; our own pipeline resizes and compresses once.
    return toResult(
      await runWithoutLock(() =>
        ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }),
      ),
    );
  },

  async chooseFromGallery(limit) {
    return toResult(
      await runWithoutLock(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: limit > 1,
          selectionLimit: limit,
          quality: 1,
        }),
      ),
    );
  },

  async pendingResult() {
    const pending = await ImagePicker.getPendingResultAsync();
    if (!pending || !('assets' in pending)) return null;
    return toResult(pending);
  },
};
