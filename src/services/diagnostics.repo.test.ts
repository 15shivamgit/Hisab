import type { DbClient } from '@/db/client';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { personRepository } from '@/db/repositories/personRepository';
import { transactionRepository } from '@/db/repositories/transactionRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import { createDiagnosticsService, databaseFacts } from '@/services/diagnosticsService';
import { memoryFiles } from '@/test/memoryFiles';
import { createTestDb, fixedClock, TEST_NOW, TEST_TODAY } from '@/test/testDb';

let db: DbClient;

beforeEach(async () => {
  db = await createTestDb();
});

test('SET-09: the diagnostic report has no amounts, names, phone numbers, or notes', async () => {
  const food = (await categoryRepository.list(db, {})).find((c) => c.name === 'Food & Dining')!;
  await transactionRepository.create(
    db,
    {
      type: 'expense',
      amountPaise: 1_234_567,
      categoryId: food.id,
      txnDate: TEST_TODAY,
      paymentMethod: 'upi',
      description: 'Dinner at Sharma Dhaba',
      notes: 'secret family note',
    },
    TEST_NOW,
  );
  const person = await personRepository.create(
    db,
    { name: 'Ramesh Kumar', phone: '9876543210', notes: 'owes for the trip' },
    TEST_NOW,
  );
  await udhaarRepository.create(
    db,
    {
      personId: person.id,
      direction: 'gave',
      amountPaise: 777_700,
      entryDate: TEST_TODAY,
      paymentMethod: 'cash',
      note: 'bike repair',
    },
    TEST_NOW,
  );

  const { store } = memoryFiles();
  const service = createDiagnosticsService({
    files: store,
    clock: fixedClock(TEST_NOW),
    appVersion: '1.0.0',
  });
  // An error whose message carries personal data: only its code may be kept.
  await service.record(new Error('Ramesh Kumar 9876543210 ₹12,345.67'), 'test');

  const report = await service.buildReport({
    appVersion: '1.0.0',
    versionCode: '1',
    androidVersion: '14 (API 34)',
    device: 'vivo V2205',
    ...(await databaseFacts(db)),
  });

  expect(report).toContain('DB schema: v');
  expect(report).toContain('transactions=1');
  expect(report).toContain('people=1');
  for (const secret of [
    'Ramesh',
    '9876543210',
    'owes',
    'bike',
    'Sharma',
    'secret',
    '12345',
    '12,345',
    '7777',
    '7,777',
  ]) {
    expect(report).not.toContain(secret);
  }
});
