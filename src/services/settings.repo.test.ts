import type { DbClient } from '@/db/client';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { createSettingsService } from '@/services/settingsService';
import { createTestDb, fixedClock, TEST_NOW } from '@/test/testDb';

const clock = fixedClock(TEST_NOW);
let db: DbClient;
let replans: number;
const service = createSettingsService({
  afterRemindersChange: async () => {
    replans++;
  },
});

beforeEach(async () => {
  db = await createTestDb();
  replans = 0;
});

const changed = () => settingsRepository.get(db, 'data_changed_since_backup');

describe('portable settings mark data as changed since the last backup', () => {
  test('theme', async () => {
    await service.setTheme(db, clock, 'dark');
    expect(await settingsRepository.get(db, 'theme')).toBe('dark');
    expect(await changed()).toBe(true);
  });

  test('week start', async () => {
    await service.setWeekStart(db, clock, 'sunday');
    expect(await settingsRepository.get(db, 'week_start')).toBe('sunday');
    expect(await changed()).toBe(true);
  });

  test('reminders on/off and time re-plan the reminders', async () => {
    await service.setRemindersEnabled(db, clock, false);
    await service.setReminderTime(db, clock, '20:30');
    expect(await settingsRepository.get(db, 'reminders_enabled')).toBe(false);
    expect(await settingsRepository.get(db, 'reminder_time')).toBe('20:30');
    expect(await changed()).toBe(true);
    expect(replans).toBe(2);
  });

  test('an invalid reminder time is rejected and nothing changes', async () => {
    await expect(service.setReminderTime(db, clock, '25:00')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(await settingsRepository.get(db, 'reminder_time')).toBe('09:00');
    expect(await changed()).toBe(false);
    expect(replans).toBe(0);
  });
});

describe('device-only settings do not mark data as changed', () => {
  test('app lock re-plans reminders (generic text while locked)', async () => {
    await service.setAppLock(db, clock, true);
    expect(await settingsRepository.get(db, 'app_lock_enabled')).toBe(true);
    expect(replans).toBe(1);
    expect(await changed()).toBe(false);
  });

  test('lock timeout and onboarding', async () => {
    await service.setLockTimeout(db, clock, 0);
    await service.completeOnboarding(db, clock);
    expect(await settingsRepository.get(db, 'app_lock_timeout_seconds')).toBe(0);
    expect(await settingsRepository.get(db, 'onboarding_completed')).toBe(true);
    expect(await changed()).toBe(false);
  });
});
