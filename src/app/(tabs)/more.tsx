import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { strings } from '@/content/strings';
import { useTheme } from '@/theme/ThemeProvider';

// Phase 4: only "Manage → Categories". The full More tab comes in Phase 9.
export default function MoreRoute() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  return (
    <Screen title={strings.tab.more} scroll>
      <AppText variant="label" color="textMuted" style={{ marginBottom: spacing.sm }}>
        {strings.more.manage}
      </AppText>
      <Card>
        <ListRow
          title={strings.more.categories}
          left={<Icon name="sell" color={colors.primary} />}
          right={<Icon name="chevron_right" color={colors.textMuted} />}
          onPress={() => router.push('/categories')}
          accessibilityLabel={strings.more.categories}
        />
      </Card>
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.lg }}>
        {strings.more.comingSoon}
      </AppText>
    </Screen>
  );
}
