// System share sheet for files (backup, CSV) and the document picker for restore.
// expo-sharing's promise resolves when the sheet closes; Android doesn't report whether
// the file was actually saved or sent (BACKUP_AND_RESTORE.md step 7, verified 2026-10-26).

import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

export async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

/** A copy of the picked file in the app's cache, or null if the user cancelled. */
export async function pickFile(): Promise<{ uri: string; name: string } | null> {
  // Any type: Drive and Files report .hisaab as zip, octet-stream, or nothing.
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { uri: asset.uri, name: asset.name } : null;
}
