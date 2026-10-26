// More → Backup & restore (BACKUP_AND_RESTORE.md, BAK-01…07).

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { TypedConfirmDialog } from '@/components/TypedConfirmDialog';
import { strings } from '@/content/strings';
import { backupRepository } from '@/db/repositories/backupRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { useDb } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { systemClock } from '@/lib/clock';
import { formatDateTime, formatLocalDate, todayLocal } from '@/lib/dates';
import { isAppError } from '@/lib/errors';
import { deviceBackupFiles } from '@/platform/backupFiles';
import { pickFile, shareFile } from '@/platform/share';
import { backup } from '@/services/backup';
import type { ValidationReport } from '@/services/backup/backupService';
import { diagnostics } from '@/services/diagnostics';
import { useTheme } from '@/theme/ThemeProvider';

type Busy = 'create' | 'check' | 'restore' | null;
type Problem = { message: string; technical: string };

function problemFrom(error: unknown): Problem {
  const errors = strings.backup.errors as Record<string, string>;
  if (isAppError(error)) {
    const key = error.code === 'STORAGE_FULL' ? 'STORAGE_FULL' : (error.detail ?? '');
    return {
      message: errors[key] ?? strings.common.somethingWrong,
      technical: `${error.code} ${error.detail ?? ''}: ${error.message}`,
    };
  }
  return { message: strings.common.somethingWrong, technical: String(error) };
}

export function BackupScreen() {
  const db = useDb();
  const router = useRouter();
  const toast = useToast();
  const { colors, spacing, radius } = useTheme();
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [missingWarning, setMissingWarning] = useState<number>(0);
  const [pending, setPending] = useState<ValidationReport | null>(null);

  const query = useDbQuery(
    async (client) => {
      const counts = await backupRepository.counts(client);
      return {
        lastBackupAt: await settingsRepository.get(client, 'last_backup_at'),
        entries: counts.transactions,
        receipts: counts.transactionAttachments,
        sizeMb: Math.max(1, Math.round((await backup.estimateBackupBytes(client)) / (1024 * 1024))),
        canUndo: backup.safetyBackupUri() !== null,
      };
    },
    [],
    { tables: ['app_settings', 'transactions', 'transaction_attachments'] },
  );

  const fail = (error: unknown, where: string) => {
    void diagnostics.record(error, where);
    setShowTechnical(false);
    setProblem(problemFrom(error));
  };

  const create = async () => {
    setBusy('create');
    setProblem(null);
    try {
      const result = await backup.create(db, systemClock);
      setMissingWarning(result.missingFiles);
      await shareFile(result.uri, 'application/zip', strings.backup.shareTitle);
      await backup.markBackedUp(db, systemClock);
      toast(strings.backup.created);
    } catch (error) {
      fail(error, 'backup.create');
    } finally {
      setBusy(null);
    }
  };

  const inspect = async (source: 'file' | 'undo') => {
    setProblem(null);
    let uri: string | null;
    let temporary = false;
    if (source === 'undo') {
      uri = backup.safetyBackupUri();
    } else {
      const picked = await pickFile();
      uri = picked?.uri ?? null;
      temporary = true;
    }
    if (!uri) return;
    setBusy('check');
    try {
      setPending(await backup.inspect(db, uri, source));
    } catch (error) {
      fail(error, 'backup.inspect');
    } finally {
      if (temporary) deviceBackupFiles.remove(uri);
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy('restore');
    try {
      await backup.restore(db, systemClock, pending);
      setPending(null);
      toast(strings.backup.restored);
      router.replace('/');
    } catch (error) {
      setPending(null);
      fail(error, 'backup.restore');
    } finally {
      setBusy(null);
    }
  };

  if (query.status === 'error') {
    return (
      <Screen>
        <ErrorState
          title={strings.common.somethingWrong}
          message={strings.common.somethingWrong}
          onRetry={query.reload}
          retryLabel={strings.common.tryAgain}
        />
      </Screen>
    );
  }

  const info = query.data;
  const busyText =
    busy === 'create'
      ? strings.backup.creating
      : busy === 'check'
        ? strings.backup.checking
        : strings.backup.restoring;

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <Card style={{ gap: spacing.sm }}>
          {info ? (
            <>
              <AppText variant="bodyStrong" color={info.lastBackupAt ? 'text' : 'danger'}>
                {info.lastBackupAt
                  ? strings.backup.lastBackup(formatDateTime(info.lastBackupAt))
                  : strings.backup.never}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {strings.backup.counts(info.entries, info.receipts, info.sizeMb)}
              </AppText>
            </>
          ) : (
            <Skeleton height={40} />
          )}
        </Card>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Icon name="warning" color={colors.danger} />
          <AppText style={{ flex: 1 }}>{strings.backup.uninstallWarning}</AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Button label={strings.backup.create} onPress={create} disabled={busy !== null} />
          <AppText variant="caption" color="textMuted">
            {strings.backup.privacy}
          </AppText>
          {missingWarning > 0 ? (
            <AppText variant="caption" color="danger">
              {strings.backup.missingReceipts(missingWarning)}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Button
            label={strings.backup.restore}
            variant="secondary"
            onPress={() => void inspect('file')}
            disabled={busy !== null}
          />
          {info?.canUndo ? (
            <>
              <Button
                label={strings.backup.undo}
                variant="ghost"
                onPress={() => void inspect('undo')}
                disabled={busy !== null}
              />
              <AppText variant="caption" color="textMuted">
                {strings.backup.undoHint}
              </AppText>
            </>
          ) : null}
        </View>

        {busy ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator color={colors.primary} />
            <AppText color="textMuted">{busyText}</AppText>
          </View>
        ) : null}

        {problem ? (
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="bodyStrong" color="danger" accessibilityLiveRegion="polite">
              {problem.message}
            </AppText>
            {showTechnical ? (
              <AppText variant="caption" color="textMuted" selectable>
                {problem.technical}
              </AppText>
            ) : (
              <Button
                label={strings.backup.technicalDetails}
                variant="ghost"
                onPress={() => setShowTechnical(true)}
              />
            )}
          </Card>
        ) : null}
      </View>

      <TypedConfirmDialog
        visible={pending !== null}
        title={strings.backup.confirmTitle}
        body={
          pending
            ? strings.backup.confirmBody(
                formatLocalDate(todayLocal(new Date(pending.createdAt)), 'long'),
                { entries: pending.counts.transactions, receipts: pending.counts.attachments },
                { entries: info?.entries ?? 0, receipts: info?.receipts ?? 0 },
              )
            : ''
        }
        word={strings.backup.confirmWord}
        confirmLabel={strings.backup.confirmLabel}
        busy={busy === 'restore'}
        onConfirm={() => void restore()}
        onCancel={() => {
          if (pending) backup.discard(pending);
          setPending(null);
        }}
      />
    </Screen>
  );
}
