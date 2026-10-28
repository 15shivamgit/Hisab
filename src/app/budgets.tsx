import { Stack } from 'expo-router';

import { strings } from '@/content/strings';
import { BudgetsScreen } from '@/features/budgets/BudgetsScreen';

export default function BudgetsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: strings.budgets.title }} />
      <BudgetsScreen />
    </>
  );
}
