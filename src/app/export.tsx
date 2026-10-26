import { Stack } from 'expo-router';

import { strings } from '@/content/strings';
import { ExportScreen } from '@/features/backup/ExportScreen';

export default function ExportRoute() {
  return (
    <>
      <Stack.Screen options={{ title: strings.exportCsv.title }} />
      <ExportScreen />
    </>
  );
}
