import { Stack } from 'expo-router';

import { strings } from '@/content/strings';
import { CategoriesScreen } from '@/features/categories/CategoriesScreen';

export default function CategoriesRoute() {
  return (
    <>
      <Stack.Screen options={{ title: strings.categories.title }} />
      <CategoriesScreen />
    </>
  );
}
