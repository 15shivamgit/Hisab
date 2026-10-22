import { AppError } from '@/lib/errors';
import {
  createDiagnosticsService,
  ERROR_LOG_PATH,
  MAX_LOG_ENTRIES,
} from '@/services/diagnosticsService';
import { memoryFiles } from '@/test/memoryFiles';
import { fixedClock, TEST_NOW } from '@/test/testDb';

const info = {
  appVersion: '1.0.0',
  versionCode: '1',
  androidVersion: '14 (API 34)',
  device: 'vivo V2205',
};

function setup(initial?: Record<string, string>) {
  const { store, files } = memoryFiles(initial);
  const service = createDiagnosticsService({
    files: store,
    clock: fixedClock(TEST_NOW),
    appVersion: '1.0.0',
  });
  return { service, files };
}

test('records code, detail, and place — not the message', async () => {
  const { service, files } = setup();
  await service.record(
    new AppError('VALIDATION', 'Rahul owes ₹7,000', { detail: 'AMOUNT_RANGE' }),
    'transactionForm',
  );
  expect(await service.entries()).toEqual([
    {
      at: TEST_NOW.toISOString(),
      code: 'VALIDATION',
      detail: 'AMOUNT_RANGE',
      where: 'transactionForm',
      appVersion: '1.0.0',
    },
  ]);
  expect(files.get(ERROR_LOG_PATH)).not.toContain('Rahul');
  expect(files.get(ERROR_LOG_PATH)).not.toContain('7,000');
});

test('unknown errors are stored as UNKNOWN without their text', async () => {
  const { service, files } = setup();
  await service.record(new Error('SQLITE note: my secret note'), 'startup');
  expect((await service.entries())[0]?.code).toBe('UNKNOWN');
  expect(files.get(ERROR_LOG_PATH)).not.toContain('secret');
});

test(`keeps only the last ${MAX_LOG_ENTRIES} entries`, async () => {
  const { service } = setup();
  for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) {
    await service.record(new AppError('NOT_FOUND', 'x', { detail: `D${i}` }), 'test');
  }
  const entries = await service.entries();
  expect(entries).toHaveLength(MAX_LOG_ENTRIES);
  expect(entries[0]?.detail).toBe('D5');
});

test('a corrupted log file is ignored and replaced', async () => {
  const { service } = setup({ [ERROR_LOG_PATH]: '{not json' });
  expect(await service.entries()).toEqual([]);
  await service.record(new AppError('NOT_FOUND', 'x'), 'test');
  expect(await service.entries()).toHaveLength(1);
});

test('record never throws, even if writing fails', async () => {
  const service = createDiagnosticsService({
    files: {
      read: async () => null,
      write: async () => {
        throw new Error('disk full');
      },
    },
    clock: fixedClock(TEST_NOW),
    appVersion: '1.0.0',
  });
  await expect(service.record(new Error('x'), 'test')).resolves.toBeUndefined();
});

test('report lists versions, device, and recent errors newest first', async () => {
  const { service } = setup();
  await service.record(new AppError('NOT_FOUND', 'x', { detail: 'FIRST' }), 'a');
  await service.record(new AppError('DB_NEWER', 'x', { detail: 'SECOND' }), 'startup');
  const report = await service.buildReport({
    ...info,
    schemaVersion: 1,
    counts: { transactions: 3 },
  });
  expect(report).toContain('App: 1.0.0 (1)');
  expect(report).toContain('Device: vivo V2205');
  expect(report).toContain('DB schema: v1');
  expect(report).toContain('Rows: transactions=3');
  expect(report.indexOf('SECOND')).toBeLessThan(report.indexOf('FIRST'));
});
