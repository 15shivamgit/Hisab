import { useLocalSearchParams } from 'expo-router';

import { UdhaarEntryScreen } from '@/features/udhaar/UdhaarEntryScreen';

export default function EditUdhaarEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UdhaarEntryScreen mode="edit" id={id} />;
}
