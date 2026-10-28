import { useLocalSearchParams } from 'expo-router';

import { UdhaarEntryScreen } from '@/features/udhaar/UdhaarEntryScreen';

export default function NewUdhaarEntryRoute() {
  const { personId, direction } = useLocalSearchParams<{ personId: string; direction?: string }>();
  return (
    <UdhaarEntryScreen
      mode="new"
      personId={personId}
      direction={direction === 'got' ? 'got' : 'gave'}
    />
  );
}
