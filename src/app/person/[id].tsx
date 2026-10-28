import { useLocalSearchParams } from 'expo-router';

import { PersonLedgerScreen } from '@/features/udhaar/PersonLedgerScreen';

export default function PersonLedgerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PersonLedgerScreen id={id} />;
}
