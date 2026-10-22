import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { strings } from '@/content/strings';

// Built in Phase 8.
export default function ReportsRoute() {
  return (
    <Screen title={strings.tab.reports}>
      <EmptyState title={strings.placeholder.title} message={strings.placeholder.reports} />
    </Screen>
  );
}
