import { useLocalSearchParams } from 'expo-router';

import { PersonFormScreen } from '@/features/udhaar/PersonFormScreen';

export default function EditPersonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PersonFormScreen mode="edit" id={id} />;
}
