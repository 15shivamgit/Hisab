import { Stack } from 'expo-router';

import { strings } from '@/content/strings';
import { BackupScreen } from '@/features/backup/BackupScreen';

export default function BackupRoute() {
  return (
    <>
      <Stack.Screen options={{ title: strings.backup.title }} />
      <BackupScreen />
    </>
  );
}
