import { Stack } from 'expo-router';

import { strings } from '@/content/strings';
import { LicensesScreen } from '@/features/settings/LicensesScreen';

export default function LicensesRoute() {
  return (
    <>
      <Stack.Screen options={{ title: strings.licenses.title }} />
      <LicensesScreen />
    </>
  );
}
