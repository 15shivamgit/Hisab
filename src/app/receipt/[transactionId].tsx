import { useLocalSearchParams } from 'expo-router';

import { ReceiptViewerScreen } from '@/features/receipts/ReceiptViewerScreen';

export default function ReceiptViewerRoute() {
  const { transactionId, index } = useLocalSearchParams<{
    transactionId: string;
    index?: string;
  }>();
  const start = Number.parseInt(index ?? '0', 10);
  return (
    <ReceiptViewerScreen
      transactionId={transactionId}
      initialIndex={Number.isFinite(start) && start >= 0 ? start : 0}
    />
  );
}
