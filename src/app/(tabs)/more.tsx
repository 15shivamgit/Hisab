import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { TypedConfirmDialog } from '@/components/TypedConfirmDialog';
import { strings } from '@/content/strings';
import { useDb } from '@/hooks/DatabaseContext';
import { systemClock } from '@/lib/clock';
import { dataService } from '@/services/appServices';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

// Phase 6: Manage, Data, Danger zone. Settings, app lock, and About come in Phase 9.
export default function MoreRoute() {
  const router = useRouter();
  const db = useDb();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const section = (label: string) => (
    <AppText
      variant="label"
      color="textMuted"
      style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
    >
      {label}
    </AppText>
  );
  const chevron = <Icon name="chevron_right" color={colors.textMuted} />;

  const deleteAll = async () => {
    setDeleting(true);
    try {
      await dataService.deleteAllData(db, systemClock);
      setConfirmDelete(false);
      toast(strings.deleteAll.done);
      router.navigate('/');
    } catch (error) {
      void diagnostics.record(error, 'deleteAllData');
      toast(strings.common.somethingWrong);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen title={strings.tab.more} scroll>
      {section(strings.more.manage)}
      <Card>
        <ListRow
          title={strings.more.categories}
          left={<Icon name="sell" color={colors.primary} />}
          right={chevron}
          onPress={() => router.push('/categories')}
          accessibilityLabel={strings.more.categories}
        />
        <ListRow
          title={strings.more.budgets}
          left={<Icon name="savings" color={colors.primary} />}
          right={chevron}
          onPress={() => router.push('/budgets')}
          accessibilityLabel={strings.more.budgets}
        />
      </Card>

      {section(strings.more.data)}
      <Card>
        <ListRow
          title={strings.more.backup}
          left={<Icon name="backup" color={colors.primary} />}
          right={chevron}
          onPress={() => router.push('/backup')}
          accessibilityLabel={strings.more.backup}
        />
        <ListRow
          title={strings.more.exportCsv}
          left={<Icon name="table_view" color={colors.primary} />}
          right={chevron}
          onPress={() => router.push('/export')}
          accessibilityLabel={strings.more.exportCsv}
        />
      </Card>

      {section(strings.more.dangerZone)}
      <Card>
        <ListRow
          title={strings.more.deleteAll}
          left={<Icon name="delete_forever" color={colors.danger} />}
          onPress={() => setConfirmDelete(true)}
          accessibilityLabel={strings.more.deleteAll}
        />
      </Card>

      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.lg }}>
        {strings.more.comingSoon}
      </AppText>
      {__DEV__ ? (
        <Card style={{ marginTop: spacing.lg }}>
          <ListRow
            title="Developer tools"
            left={<Icon name="build" color={colors.textMuted} />}
            onPress={() => router.push('/dev-tools')}
            accessibilityLabel="Developer tools"
          />
        </Card>
      ) : null}

      <TypedConfirmDialog
        visible={confirmDelete}
        title={strings.deleteAll.title}
        body={strings.deleteAll.body}
        word={strings.deleteAll.word}
        confirmLabel={strings.deleteAll.confirm}
        busy={deleting}
        onConfirm={() => void deleteAll()}
        onCancel={() => setConfirmDelete(false)}
        extra={{
          label: strings.deleteAll.backupFirst,
          onPress: () => {
            setConfirmDelete(false);
            router.push('/backup');
          },
        }}
      />
    </Screen>
  );
}
