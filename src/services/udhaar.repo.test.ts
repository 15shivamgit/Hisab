import type { DbClient } from '@/db/client';
import { personRepository } from '@/db/repositories/personRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { udhaarRepository } from '@/db/repositories/udhaarRepository';
import { reminderMessage, reminderNotification } from '@/content/templates';
import type { LocalNotifications, NotificationPermission } from '@/platform/notifications';
import { dashboardService } from '@/services/dashboardService';
import { createReminderService, reminderMoment } from '@/services/reminderService';
import { createUdhaarService } from '@/services/udhaarService';
import { createTestDb, fixedClock, TEST_NOW, TEST_TODAY } from '@/test/testDb';
import { transactionService } from '@/services/transactionService';
import { categoryRepository } from '@/db/repositories/categoryRepository';

const clock = fixedClock(TEST_NOW); // 2026-10-21 10:00 IST
let db: DbClient;
let afterChange: jest.Mock;
let udhaar: ReturnType<typeof createUdhaarService>;

beforeEach(async () => {
  db = await createTestDb();
  afterChange = jest.fn().mockResolvedValue(undefined);
  udhaar = createUdhaarService({ afterChange });
});

const R = (rupees: number) => rupees * 100;

async function person(name = 'Rahul', extra: { phone?: string } = {}) {
  return udhaar.createPerson(db, clock, { name, ...extra });
}

function entry(
  personId: string,
  direction: 'gave' | 'got',
  rupees: number,
  entryDate = TEST_TODAY,
) {
  return udhaar.addEntry(db, clock, {
    personId,
    direction,
    amountPaise: R(rupees),
    entryDate,
    paymentMethod: 'cash',
  });
}

const balance = async (id: string) =>
  (await personRepository.getWithBalance(db, id, TEST_TODAY))?.balancePaise;

describe('people (UDH-01, UDH-11)', () => {
  test('name trimmed, phone normalised, empty optional fields are null', async () => {
    const p = await person('  Rahul  ', { phone: '+91 98765-43210' });
    expect(p).toMatchObject({
      name: 'Rahul',
      phone: '+919876543210',
      notes: null,
      returnByDate: null,
    });
    await expect(person('')).rejects.toMatchObject({ detail: 'person.name' });
    await expect(person('A', { phone: '123' })).rejects.toMatchObject({ detail: 'person.phone' });
  });

  test('same name is allowed (warning only) and counted', async () => {
    await person('Rahul');
    await person('rahul');
    expect(await personRepository.sameNameCount(db, 'RAHUL')).toBe(2);
  });

  test('FIN-U14: a person with entries cannot be deleted', async () => {
    const p = await person();
    await entry(p.id, 'gave', 100);
    await expect(udhaar.deletePerson(db, clock, p.id)).rejects.toMatchObject({
      code: 'IN_USE',
      detail: 'PERSON_HAS_ENTRIES',
    });
    const empty = await person('Amit');
    await udhaar.deletePerson(db, clock, empty.id);
    expect(await personRepository.getWithBalance(db, empty.id, TEST_TODAY)).toBeNull();
  });

  test('FIN-U15: only a settled person can be archived; archived are hidden', async () => {
    const p = await person();
    await entry(p.id, 'gave', 500);
    await expect(udhaar.setArchived(db, clock, p.id, true)).rejects.toMatchObject({
      detail: 'PERSON_NOT_SETTLED',
    });
    await entry(p.id, 'got', 500);
    await udhaar.setArchived(db, clock, p.id, true);
    expect(await personRepository.listWithBalances(db, {}, TEST_TODAY)).toEqual([]);
    expect(
      await personRepository.listWithBalances(db, { includeArchived: true }, TEST_TODAY),
    ).toHaveLength(1);
  });
});

describe('entries and balances (UDH-02…06)', () => {
  test('FIN-U07 / U08: edit and delete recompute the balance', async () => {
    const p = await person();
    await entry(p.id, 'gave', 10_000);
    const { entry: got } = await entry(p.id, 'got', 3_000);
    expect(await balance(p.id)).toBe(R(7_000));
    await udhaar.updateEntry(db, clock, got.id, { amountPaise: R(4_000) });
    expect(await balance(p.id)).toBe(R(6_000));
    await udhaar.deleteEntry(db, clock, got.id);
    expect(await balance(p.id)).toBe(R(10_000));
  });

  test('ledger is newest first with the running balance after each entry', async () => {
    const p = await person();
    await entry(p.id, 'gave', 10_000, '2026-10-01');
    await entry(p.id, 'got', 2_000, '2026-10-15');
    await entry(p.id, 'got', 3_000, '2026-10-10');
    const ledger = await udhaarRepository.listByPerson(db, p.id);
    expect(ledger.map((e) => [e.entryDate, e.balanceAfterPaise])).toEqual([
      ['2026-10-15', R(5_000)],
      ['2026-10-10', R(7_000)],
      ['2026-10-01', R(10_000)],
    ]);
  });

  test('FIN-U11: future-dated entries are rejected (add and edit)', async () => {
    const p = await person();
    await expect(entry(p.id, 'gave', 100, '2026-10-22')).rejects.toMatchObject({
      detail: 'date.future.udhaar',
    });
    const { entry: e } = await entry(p.id, 'gave', 100);
    await expect(
      udhaar.updateEntry(db, clock, e.id, { entryDate: '2026-10-22' }),
    ).rejects.toMatchObject({ detail: 'date.future.udhaar' });
  });

  test('preview and flip warning, including while editing', async () => {
    const p = await person();
    await entry(p.id, 'gave', 10_000);
    const { entry: got } = await entry(p.id, 'got', 3_000);
    expect(
      await udhaar.previewBalanceAfter(db, p.id, { direction: 'got', amountPaise: R(8_000) }),
    ).toEqual({ before: R(7_000), after: R(-1_000), flips: true });
    // Editing the 3,000 entry to 12,000: the 3,000 isn't counted twice.
    expect(
      await udhaar.previewBalanceAfter(
        db,
        p.id,
        { direction: 'got', amountPaise: R(12_000) },
        got.id,
      ),
    ).toEqual({ before: R(10_000), after: R(-2_000), flips: true });
  });

  test('writes mark data changed, re-plan reminders, and return the person', async () => {
    const p = await person();
    await settingsRepository.set(db, 'data_changed_since_backup', false, TEST_NOW);
    afterChange.mockClear();
    const { person: after } = await entry(p.id, 'gave', 700);
    expect(after).toMatchObject({ balancePaise: R(700), label: 'will_get' });
    expect(await settingsRepository.get(db, 'data_changed_since_backup')).toBe(true);
    expect(afterChange).toHaveBeenCalledTimes(1);
  });

  test('return-by date: today or later; null clears it', async () => {
    const p = await person();
    await expect(udhaar.setReturnByDate(db, clock, p.id, '2026-10-20')).rejects.toMatchObject({
      detail: 'RETURN_BY_PAST',
    });
    expect((await udhaar.setReturnByDate(db, clock, p.id, TEST_TODAY)).returnByDate).toBe(
      TEST_TODAY,
    );
    expect((await udhaar.setReturnByDate(db, clock, p.id, null)).returnByDate).toBeNull();
  });

  test('FIN-U10 / UDH-12: udhaar never changes income, expense, or category totals', async () => {
    const food = (await categoryRepository.list(db, { type: 'expense' })).find(
      (c) => c.name === 'Food & Dining',
    )!;
    await transactionService.create(db, clock, {
      type: 'expense',
      amountPaise: R(450),
      categoryId: food.id,
      txnDate: TEST_TODAY,
      paymentMethod: 'upi',
    });
    const before = await dashboardService.getSummary(db, TEST_TODAY);
    const p = await person();
    await entry(p.id, 'gave', 10_000);
    await entry(p.id, 'got', 3_000);
    const after = await dashboardService.getSummary(db, TEST_TODAY);
    expect(after.incomePaise).toBe(before.incomePaise);
    expect(after.expensePaise).toBe(before.expensePaise);
    expect(after.topCategories).toEqual(before.topCategories);
    expect(after.recent.map((t) => t.id)).toEqual(before.recent.map((t) => t.id));
  });
});

describe('people list (UDH-10) and totals (FIN-U09)', () => {
  test('filters, search, sort, and totals that are never netted', async () => {
    const a = await person('Amit');
    const b = await person('Bina');
    const c = await person('Chetan');
    const d = await person('Deepa');
    await entry(a.id, 'gave', 7_000);
    await entry(b.id, 'got', 6_000);
    await entry(c.id, 'gave', 100);
    await entry(c.id, 'got', 100);
    await entry(d.id, 'gave', 500);
    await udhaar.setReturnByDate(db, clock, a.id, TEST_TODAY);
    await personRepository.update(db, a.id, { returnByDate: '2026-10-19' }, TEST_NOW); // past, set directly

    const names = async (q: Parameters<typeof personRepository.listWithBalances>[1]) =>
      (await personRepository.listWithBalances(db, q, TEST_TODAY)).map((p) => p.name);
    expect(await names({})).toEqual(['Amit', 'Bina', 'Deepa', 'Chetan']); // |amount| desc
    expect(await names({ sort: 'name_asc' })).toEqual(['Amit', 'Bina', 'Chetan', 'Deepa']);
    expect(await names({ filter: 'will_get' })).toEqual(['Amit', 'Deepa']);
    expect(await names({ filter: 'owe' })).toEqual(['Bina']);
    expect(await names({ filter: 'settled' })).toEqual(['Chetan']);
    expect(await names({ filter: 'overdue' })).toEqual(['Amit']);
    expect(await names({ search: 'ee' })).toEqual(['Deepa']);
    expect(await names({ search: '%' })).toEqual([]);

    expect(await udhaarRepository.totals(db)).toEqual({
      youWillGetPaise: R(7_500),
      willGetCount: 2,
      youOwePaise: R(6_000),
      oweCount: 1,
    });
  });

  test('CSV source: every entry with person and balance after, oldest first, range filter', async () => {
    const a = await person('Amit');
    const b = await person('Bina');
    await entry(a.id, 'gave', 1_000, '2026-10-01');
    await entry(b.id, 'got', 500, '2026-10-05');
    await entry(a.id, 'got', 400, '2026-10-10');
    const all = await udhaarRepository.listAll(db);
    expect(all.map((e) => [e.entryDate, e.personName, e.balanceAfterPaise])).toEqual([
      ['2026-10-01', 'Amit', R(1_000)],
      ['2026-10-05', 'Bina', R(-500)],
      ['2026-10-10', 'Amit', R(600)],
    ]);
    const october = await udhaarRepository.listAll(db, { start: '2026-10-05', end: '2026-10-31' });
    expect(october.map((e) => e.balanceAfterPaise)).toEqual([R(-500), R(600)]);
  });
});

describe('reminders (UDH-08, FIN-U16)', () => {
  function fakeNotifications(permission: NotificationPermission = 'granted') {
    const scheduled: { title: string; body: string; date: Date; personId: string }[] = [];
    let cancelled = 0;
    const port: LocalNotifications = {
      ensureChannel: jest.fn().mockResolvedValue(undefined),
      permission: async () => permission,
      requestPermission: async () => permission,
      cancelAll: async () => {
        cancelled++;
        scheduled.length = 0;
      },
      schedule: async (n) => void scheduled.push(n),
    };
    return { port, scheduled, cancelled: () => cancelled };
  }

  async function setup() {
    const a = await person('Amit');
    const b = await person('Bina');
    const c = await person('Chetan');
    await entry(a.id, 'gave', 7_000);
    await entry(c.id, 'gave', 500);
    await udhaar.setReturnByDate(db, clock, a.id, '2026-10-25');
    await udhaar.setReturnByDate(db, clock, b.id, '2026-10-25');
    await personRepository.update(db, c.id, { returnByDate: '2026-10-19' }, TEST_NOW);
    return { a };
  }

  test('FIN-U16: only open balances with a date from today are scheduled, at reminder_time', async () => {
    const { a } = await setup();
    const n = fakeNotifications();
    expect(await createReminderService(n.port).reconcile(db, clock)).toBe(1);
    expect(n.scheduled).toEqual([
      {
        title: 'Udhaar reminder',
        body: 'Amit was to return ₹7,000 today.',
        date: reminderMoment('2026-10-25', '09:00'),
        personId: a.id,
      },
    ]);
    expect(n.scheduled[0]!.date.getHours()).toBe(9);
  });

  test('idempotent: running again cancels and re-plans the same set', async () => {
    await setup();
    const n = fakeNotifications();
    const service = createReminderService(n.port);
    await service.reconcile(db, clock);
    await service.reconcile(db, clock);
    expect(n.scheduled).toHaveLength(1);
    expect(n.cancelled()).toBe(2);
  });

  test('nothing scheduled when reminders are off, permission is missing, or today has passed', async () => {
    const { a } = await setup();
    const denied = fakeNotifications('denied');
    expect(await createReminderService(denied.port).reconcile(db, clock)).toBe(0);

    await settingsRepository.set(db, 'reminders_enabled', false, TEST_NOW);
    expect(await createReminderService(fakeNotifications().port).reconcile(db, clock)).toBe(0);
    await settingsRepository.set(db, 'reminders_enabled', true, TEST_NOW);

    // Due today at 09:00, but it's already 10:00 → in-app badge only.
    await udhaar.setReturnByDate(db, clock, a.id, TEST_TODAY);
    expect(await createReminderService(fakeNotifications().port).reconcile(db, clock)).toBe(0);
  });

  test('generic text while app lock is on', async () => {
    await setup();
    await settingsRepository.set(db, 'app_lock_enabled', true, TEST_NOW);
    const n = fakeNotifications();
    await createReminderService(n.port).reconcile(db, clock);
    expect(n.scheduled[0]).toMatchObject({ title: 'Hisaab', body: 'You have an udhaar reminder.' });
  });
});

describe('message templates (MESSAGE_TEMPLATES.md)', () => {
  test('owes the user, with and without a date; user owes', () => {
    expect(reminderMessage({ name: 'Rahul', balancePaise: R(7_000), returnByDate: null })).toBe(
      'Hi Rahul, just a gentle reminder about the ₹7,000 I gave you. Please return it when you can. Thanks!',
    );
    expect(
      reminderMessage({ name: 'Rahul', balancePaise: R(7_000), returnByDate: '2026-10-25' }),
    ).toBe(
      "Hi Rahul, just a reminder about the ₹7,000. You had said you'd return it by 25 Oct. Thanks!",
    );
    expect(reminderMessage({ name: 'Amit', balancePaise: R(-6_000.5), returnByDate: null })).toBe(
      "Hi Amit, I haven't forgotten the ₹6,000.50 I owe you. I'll return it soon. Thanks for your help!",
    );
    expect(reminderNotification({ name: 'Amit', balancePaise: R(-6_000) }, false).body).toBe(
      'You planned to return ₹6,000 to Amit today.',
    );
  });
});

describe('dashboard udhaar card (DASH-05, DASH-06)', () => {
  test('hidden without people; totals and up to 3 people: overdue first, then due soon', async () => {
    expect((await dashboardService.getSummary(db, TEST_TODAY)).udhaar).toBeNull();
    const names = ['A', 'B', 'C', 'D', 'E'];
    const people = [];
    for (const n of names) people.push(await person(n));
    for (const p of people) await entry(p.id, 'gave', 100);
    const due: Record<string, string> = {
      A: '2026-10-27',
      B: '2026-10-18',
      C: '2026-10-22',
      D: '2026-10-15',
      E: '2026-11-30',
    };
    for (const p of people)
      await personRepository.update(db, p.id, { returnByDate: due[p.name] }, TEST_NOW);
    const card = (await dashboardService.getSummary(db, TEST_TODAY)).udhaar!;
    expect(card.totals).toMatchObject({ youWillGetPaise: R(500), willGetCount: 5 });
    expect(card.attention.map((p) => p.name)).toEqual(['D', 'B', 'C']);
  });
});
