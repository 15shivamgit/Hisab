import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { strings } from '@/content/strings';

// Built in Phase 7.
export default function UdhaarRoute() {
  return (
    <Screen title={strings.tab.udhaar}>
      <EmptyState title={strings.placeholder.title} message={strings.placeholder.udhaar} />
    </Screen>
  );
}
