import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';

import { ToastProvider } from '@/components/Toast';
import type { DbClient } from '@/db/client';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { LockGate } from '@/features/lock/LockGate';
import { DatabaseProvider } from '@/hooks/DatabaseContext';
import { SettingsProvider } from '@/hooks/SettingsContext';
import { systemClock } from '@/lib/clock';
import { deviceLock } from '@/platform/deviceLock';
import { runWithoutLock } from '@/platform/lockSession';
import { createTestDb, TEST_NOW } from '@/test/testDb';
import { TestProviders } from '@/test/TestProviders';

jest.mock('@/platform/deviceLock', () => ({
  deviceLock: {
    hasScreenLock: jest.fn(),
    authenticate: jest.fn(),
    setSecureFlag: jest.fn(async () => {}),
  },
}));
jest.mock('@/services/appServices', () => {
  const { createSettingsService } = jest.requireActual('@/services/settingsService');
  return { settings: createSettingsService({ afterRemindersChange: async () => {} }) };
});

const lock = jest.mocked(deviceLock);
let db: DbClient;
let appStateListener: (state: AppStateStatus) => void;
let now = TEST_NOW.getTime();

beforeEach(async () => {
  db = await createTestDb();
  jest.clearAllMocks();
  lock.hasScreenLock.mockResolvedValue(true);
  lock.authenticate.mockResolvedValue('success');
  now = TEST_NOW.getTime();
  jest.spyOn(systemClock, 'now').mockImplementation(() => new Date(now));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});

async function setLock(enabled: boolean, timeout: 0 | 30 | 60 | 300 = 60) {
  await settingsRepository.set(db, 'app_lock_enabled', enabled, TEST_NOW);
  await settingsRepository.set(db, 'app_lock_timeout_seconds', timeout, TEST_NOW);
}

async function renderGate() {
  await render(
    <TestProviders>
      <ToastProvider>
        <DatabaseProvider db={db}>
          <SettingsProvider>
            <LockGate>
              <Text>Balance ₹500</Text>
            </LockGate>
          </SettingsProvider>
        </DatabaseProvider>
      </ToastProvider>
    </TestProviders>,
  );
}

async function goAway(seconds: number) {
  await act(async () => appStateListener('background'));
  now += seconds * 1000;
  await act(async () => appStateListener('active'));
}

test('lock off: the app opens straight away and the secure flag is cleared', async () => {
  await setLock(false);
  await renderGate();
  expect(await screen.findByText('Balance ₹500')).toBeTruthy();
  expect(lock.authenticate).not.toHaveBeenCalled();
  expect(lock.setSecureFlag).toHaveBeenCalledWith(false);
});

test('lock on, cold start: nothing below the gate renders until unlocked', async () => {
  await setLock(true);
  let finish: (r: 'success') => void = () => {};
  lock.authenticate.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  await renderGate();
  expect(await screen.findByText('Hisaab is locked')).toBeTruthy();
  expect(screen.queryByText('Balance ₹500')).toBeNull();
  expect(lock.setSecureFlag).toHaveBeenCalledWith(true);

  await act(async () => finish('success'));
  expect(await screen.findByText('Balance ₹500')).toBeTruthy();
  expect(screen.queryByText('Hisaab is locked')).toBeNull();
});

test('cancelling the prompt keeps the lock screen; Unlock asks again', async () => {
  await setLock(true);
  lock.authenticate.mockResolvedValueOnce('cancelled');
  await renderGate();
  expect(await screen.findByText('Hisaab is locked')).toBeTruthy();
  expect(screen.queryByText('Balance ₹500')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText('Balance ₹500')).toBeTruthy();
  expect(lock.authenticate).toHaveBeenCalledTimes(2);
});

test('timeout: back within the timeout stays open; after it, the app locks over the screens', async () => {
  await setLock(true, 60);
  await renderGate();
  expect(await screen.findByText('Balance ₹500')).toBeTruthy();

  let finish: (r: 'success') => void = () => {};
  lock.authenticate.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  await goAway(30);
  expect(screen.queryByText('Hisaab is locked')).toBeNull();

  await goAway(61);
  expect(await screen.findByText('Hisaab is locked')).toBeTruthy();
  // Screens stay mounted underneath, so unsaved form input survives.
  expect(screen.getByText('Balance ₹500')).toBeTruthy();
  await act(async () => finish('success'));
  expect(screen.queryByText('Hisaab is locked')).toBeNull();
});

test('"Immediately": a system screen Hisaab opened does not lock within 5 minutes', async () => {
  await setLock(true, 0);
  await renderGate();
  expect(await screen.findByText('Balance ₹500')).toBeTruthy();
  lock.authenticate.mockClear();

  let closeCamera: () => void = () => {};
  const camera = runWithoutLock(() => new Promise<void>((resolve) => (closeCamera = resolve)));
  await goAway(4 * 60);
  closeCamera();
  await camera;
  expect(screen.queryByText('Hisaab is locked')).toBeNull();
  expect(lock.authenticate).not.toHaveBeenCalled();

  // A normal trip away with "Immediately" locks and asks for authentication.
  lock.authenticate.mockReturnValueOnce(new Promise(() => {}));
  await goAway(1);
  expect(await screen.findByText('Hisaab is locked')).toBeTruthy();
  expect(lock.authenticate).toHaveBeenCalledTimes(1);
});

test('phone screen lock removed: app lock turns itself off and says so once', async () => {
  await setLock(true);
  lock.hasScreenLock.mockResolvedValue(false);
  await renderGate();
  expect(await screen.findByText('Balance ₹500')).toBeTruthy();
  expect(
    screen.getByText('App lock was turned off because this phone no longer has a screen lock.'),
  ).toBeTruthy();
  expect(await settingsRepository.get(db, 'app_lock_enabled')).toBe(false);
  expect(lock.authenticate).not.toHaveBeenCalled();
});
