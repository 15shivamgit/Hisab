// Thin wrapper over expo-file-system so services can be tested with an in-memory fake.

import { Directory, File, Paths } from 'expo-file-system';

/** Small text files under the app's document directory. Paths use '/' and no '..'. */
export interface TextFileStore {
  read(relativePath: string): Promise<string | null>;
  write(relativePath: string, text: string): Promise<void>;
}

function segments(relativePath: string): string[] {
  const parts = relativePath.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) {
    throw new Error('Unsafe relative path');
  }
  return parts;
}

export const documentTextFiles: TextFileStore = {
  async read(relativePath) {
    const file = new File(Paths.document, ...segments(relativePath));
    return file.exists ? file.text() : null;
  },

  async write(relativePath, text) {
    const parts = segments(relativePath);
    if (parts.length > 1) {
      const dir = new Directory(Paths.document, ...parts.slice(0, -1));
      if (!dir.exists) dir.create({ intermediates: true });
    }
    const file = new File(Paths.document, ...parts);
    if (!file.exists) file.create();
    await file.write(text);
  },
};
