import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { strings } from '@/content/strings';

interface PlaceholderScreenProps {
  title: string;
  message: string;
}

/** Temporary tab content until each feature's phase builds the real screen. */
export function PlaceholderScreen({ title, message }: PlaceholderScreenProps) {
  return (
    <Screen title={title}>
      <EmptyState title={strings.placeholder.title} message={message} />
    </Screen>
  );
}
