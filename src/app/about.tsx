import { Stack } from 'expo-router';

import { strings } from '@/content/strings';
import { AboutScreen } from '@/features/settings/AboutScreen';

export default function AboutRoute() {
  return (
    <>
      <Stack.Screen options={{ title: strings.about.title }} />
      <AboutScreen />
    </>
  );
}
