import { useLocalSearchParams } from 'expo-router';

import { TransactionEditorScreen } from '@/features/transactions/TransactionEditorScreen';

export default function NewTransactionRoute() {
  const { type, duplicateOf } = useLocalSearchParams<{ type?: string; duplicateOf?: string }>();
  return (
    <TransactionEditorScreen
      mode="new"
      type={type === 'income' ? 'income' : 'expense'}
      duplicateOf={duplicateOf || undefined}
    />
  );
}
