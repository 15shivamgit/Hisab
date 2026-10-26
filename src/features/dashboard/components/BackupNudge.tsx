// Dashboard backup reminder (DASH-08). Hidden unless the rule in backupNudge.ts says so.

import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { strings } from '@/content/strings';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { systemClock } from '@/lib/clock';
import type { LocalDate } from '@/lib/dates';
import { backupNudgeService } from '@/services/backupNudge';
import { useTheme } from '@/theme/ThemeProvider';

export function BackupNudge({ today }: { today: LocalDate }) {
  const db = useDb();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  // `today` re-runs the check after midnight.
  const nudge = useDbQuery((client) => backupNudgeService.get(client, systemClock.now()), [today], {
    tables: ['app_settings', 'transactions'],
  });
  if (nudge.status !== 'success' || !nudge.data) return null;
  const { daysSince } = nudge.data;

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="backup" color={colors.danger} />
        <AppText style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {daysSince === null ? strings.nudge.never : strings.nudge.daysAgo(daysSince)}
        </AppText>
        <Pressable
          onPress={() => void backupNudgeService.dismiss(db, systemClock)}
          accessibilityRole="button"
          accessibilityLabel={strings.nudge.dismiss}
          hitSlop={12}
        >
          <Icon name="close" color={colors.textMuted} />
        </Pressable>
      </View>
      <Button label={strings.nudge.action} onPress={() => router.push('/backup')} />
    </Card>
  );
}
