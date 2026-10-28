import { useLocalSearchParams } from 'expo-router';

import { PersonPickerScreen } from '@/features/udhaar/PersonPickerScreen';

export default function PickPersonRoute() {
  const { direction } = useLocalSearchParams<{ direction?: string }>();
  return <PersonPickerScreen direction={direction === 'got' ? 'got' : 'gave'} />;
}
