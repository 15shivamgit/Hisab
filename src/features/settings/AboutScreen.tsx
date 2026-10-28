// About (SET-07, SET-09): version, privacy promise, licences, and diagnostic info. Owner
// decision 2026-10-28: diagnostics go through the share sheet (it has its own Copy
// button), not a clipboard dependency.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { strings } from '@/content/strings';
import { useDb } from '@/hooks/DatabaseContext';
import { getAppAndDeviceInfo } from '@/platform/deviceInfo';
import { shareText } from '@/platform/system';
import { diagnostics } from '@/services/diagnostics';
import { databaseFacts } from '@/services/diagnosticsService';
import { useTheme } from '@/theme/ThemeProvider';

export function AboutScreen() {
  const router = useRouter();
  const db = useDb();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const [sharing, setSharing] = useState(false);
  const info = getAppAndDeviceInfo();

  const shareDiagnostics = async () => {
    setSharing(true);
    try {
      const facts = await databaseFacts(db);
      await shareText(await diagnostics.buildReport({ ...info, ...facts }));
    } catch (error) {
      void diagnostics.record(error, 'about.diagnostics');
      toast(strings.common.somethingWrong);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Icon name="currency_rupee" size={48} color={colors.primary} />
          <AppText variant="title">Hisaab</AppText>
          <AppText color="textMuted">
            {strings.about.version(info.appVersion, info.versionCode)}
          </AppText>
        </View>

        <Card style={{ gap: spacing.sm }}>
          <AppText>{strings.about.privacy}</AppText>
          <AppText color="textMuted">{strings.about.separateData}</AppText>
        </Card>

        <Card>
          <ListRow
            title={strings.about.licenses}
            left={<Icon name="description" color={colors.primary} />}
            right={<Icon name="chevron_right" color={colors.textMuted} />}
            onPress={() => router.push('/licenses')}
            accessibilityLabel={strings.about.licenses}
          />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <AppText variant="caption" color="textMuted">
            {strings.about.diagnosticsHint}
          </AppText>
          <Button
            label={strings.about.shareDiagnostics}
            variant="secondary"
            onPress={() => void shareDiagnostics()}
            loading={sharing}
          />
        </Card>
      </View>
    </Screen>
  );
}
