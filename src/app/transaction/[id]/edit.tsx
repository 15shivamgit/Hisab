import { useLocalSearchParams } from 'expo-router';

import { TransactionEditorScreen } from '@/features/transactions/TransactionEditorScreen';

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransactionEditorScreen mode="edit" id={id} />;
}
