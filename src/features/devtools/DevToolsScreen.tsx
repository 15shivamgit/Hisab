// Debug builds only (not reachable in release). Runs the Phase 6 backup spike and the
// restore crash test (BACKUP_AND_RESTORE.md § Phase 6 spike, § Acceptance). Text here is
// for the developer, so it is not in strings.ts.

import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { notifyChanged } from '@/db/changes';
import { backupRepository } from '@/db/repositories/backupRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { seedSpikeData } from '@/features/devtools/spikeData';
import { useDb } from '@/hooks/DatabaseContext';
import { systemClock } from '@/lib/clock';
import { deviceBackupFiles } from '@/platform/backupFiles';
import { backup, restoreDebug } from '@/services/backup';
import { useTheme } from '@/theme/ThemeProvider';

const MB = 1024 * 1024;

export function DevToolsScreen() {
  const db = useDb();
  const { spacing } = useTheme();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const add = (line: string) => setLog((l) => [...l, line]);

  async function timed(label: string, task: () => Promise<string | void>) {
    setBusy(true);
    add(`${label}…`);
    const start = Date.now();
    try {
      const detail = await task();
      add(`${label}: ${Date.now() - start} ms${detail ? ` — ${detail}` : ''}`);
    } catch (error) {
      add(`${label} FAILED after ${Date.now() - start} ms: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const counts = async () => JSON.stringify(await backupRepository.counts(db));

  // The newest backup in cache/exports, so the crash test works after an app restart.
  const newestBackup = (): string | null => {
    if (lastBackup) return lastBackup;
    const dir = deviceBackupFiles.cacheUri('exports');
    const name = deviceBackupFiles
      .list(dir)
      .filter((n) => n.endsWith('.hisaab'))
      .sort()
      .pop();
    return name ? `${dir}/${name}` : null;
  };

  if (!__DEV__) return null;

  return (
    <Screen title="Developer tools" scroll>
      <View style={{ gap: spacing.sm }}>
        <Button
          label="Seed spike data (5000 entries, 300 × 300 KB receipts)"
          disabled={busy}
          onPress={() =>
            timed('Seed', async () => {
              await seedSpikeData(
                db,
                deviceBackupFiles,
                { transactions: 5000, receipts: 300, receiptBytes: 300_000 },
                systemClock.now(),
              );
              return counts();
            })
          }
        />
        <Button
          label="Seed small (10 entries, 5 receipts)"
          variant="secondary"
          disabled={busy}
          onPress={() =>
            timed('Seed small', async () => {
              await seedSpikeData(
                db,
                deviceBackupFiles,
                { transactions: 10, receipts: 5, receiptBytes: 300_000 },
                systemClock.now(),
              );
              return counts();
            })
          }
        />
        <Button
          label="Create backup"
          disabled={busy}
          onPress={() =>
            timed('Backup', async () => {
              const result = await backup.create(db, systemClock);
              setLastBackup(result.uri);
              return `${(result.sizeBytes / MB).toFixed(1)} MB, ${JSON.stringify(result.counts)}`;
            })
          }
        />
        <Button
          label="Restore last backup (inspect + restore)"
          disabled={busy}
          onPress={() =>
            timed('Restore', async () => {
              const uri = newestBackup();
              if (!uri) return 'no backup in cache/exports';
              const t0 = Date.now();
              const report = await backup.inspect(db, uri, 'file');
              const inspectMs = Date.now() - t0;
              await backup.restore(db, systemClock, report);
              return `inspect ${inspectMs} ms; ${await counts()}`;
            })
          }
        />
        <Button
          label="Crash test: pause 20 s before the DB step"
          variant="secondary"
          onPress={() => {
            restoreDebug.pauseMs = { db: 20_000, files: 0 };
            add('Next restore pauses 20 s before the DB step — kill the app then.');
          }}
        />
        <Button
          label="Crash test: pause 20 s after the DB commit"
          variant="secondary"
          onPress={() => {
            restoreDebug.pauseMs = { db: 0, files: 20_000 };
            add('Next restore pauses 20 s after the DB commit — kill the app then.');
          }}
        />
        <Button label="Show counts" variant="secondary" onPress={() => timed('Counts', counts)} />
        <Button
          label="Nudge test: last backup 8 days ago, data changed"
          variant="secondary"
          onPress={() =>
            timed('Nudge test', async () => {
              const now = systemClock.now();
              const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
              await settingsRepository.set(db, 'last_backup_at', eightDaysAgo.toISOString(), now);
              await settingsRepository.set(db, 'data_changed_since_backup', true, now);
              await settingsRepository.set(db, 'backup_nudge_dismissed_until', null, now);
              notifyChanged(['app_settings']);
            })
          }
        />
      </View>
      <Card style={{ marginTop: spacing.lg }}>
        {log.map((line, i) => (
          <AppText key={i} variant="caption" accessibilityLabel={`log-${i}`}>
            {line}
          </AppText>
        ))}
      </Card>
    </Screen>
  );
}
