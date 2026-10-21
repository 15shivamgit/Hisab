import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { strings } from '@/content/strings';

export default function TransactionsScreen() {
  return (
    <PlaceholderScreen
      title={strings.tab.transactions}
      message={strings.placeholder.transactions}
    />
  );
}
