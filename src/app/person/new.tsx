import { useLocalSearchParams } from 'expo-router';

import { PersonFormScreen } from '@/features/udhaar/PersonFormScreen';

export default function NewPersonRoute() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  return (
    <PersonFormScreen mode="new" then={then === 'gave' || then === 'got' ? then : undefined} />
  );
}
