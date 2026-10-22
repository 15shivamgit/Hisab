import type { TransactionListItem } from '@/db/types';
import { groupTransactions } from '@/features/transactions/grouping';
import { activeFilterCount, EMPTY_FILTER, toTxnFilter } from '@/features/transactions/listFilter';
import {
  emptyFormValues,
  toFormValues,
  toNewTransaction,
  transactionFormSchema,
} from '@/features/transactions/schema';

const TODAY = '2026-10-21';

function item(
  id: string,
  txnDate: string,
  type: 'income' | 'expense',
  amountPaise: number,
): TransactionListItem {
  return {
    id,
    type,
    amountPaise,
    categoryId: 'c',
    txnDate,
    paymentMethod: 'upi',
    description: null,
    notes: null,
    createdAt: 'x',
    updatedAt: 'x',
    categoryName: 'Food',
    categoryIcon: 'restaurant',
    categoryColor: 'cat.orange',
    attachmentCount: 0,
  };
}

describe('groupTransactions', () => {
  const items = [
    item('f', '2026-10-25', 'expense', 500_000),
    item('a', '2026-10-21', 'expense', 45_000),
    item('b', '2026-10-21', 'income', 100_000),
    item('c', '2026-10-19', 'expense', 4_500),
  ];

  test('day headers with net; future rows grouped under Upcoming at the top', () => {
    const entries = groupTransactions(items, TODAY, 'date_desc');
    expect(
      entries.map((e) =>
        e.kind === 'header' ? `H:${e.date}:${e.netPaise}` : `${e.key}${e.upcoming ? '*' : ''}`,
      ),
    ).toEqual([
      'H:upcoming:-500000',
      'f*',
      'H:2026-10-21:55000',
      'a',
      'b',
      'H:2026-10-19:-4500',
      'c',
    ]);
  });

  test('Upcoming stays on top even for oldest-first sort', () => {
    const asc = groupTransactions([...items].reverse(), TODAY, 'date_asc');
    expect(asc[0]).toMatchObject({ kind: 'header', date: 'upcoming' });
  });

  test('amount sorts have no headers', () => {
    const entries = groupTransactions(items, TODAY, 'amount_desc');
    expect(entries.every((e) => e.kind === 'row')).toBe(true);
    expect(entries.find((e) => e.key === 'f')).toMatchObject({ upcoming: true });
  });
});

describe('list filter', () => {
  test('periods become ranges', () => {
    expect(
      toTxnFilter({ ...EMPTY_FILTER, period: 'this_month' }, TODAY, '', 'date_desc').range,
    ).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    });
    expect(
      toTxnFilter({ ...EMPTY_FILTER, period: 'last_month' }, TODAY, '', 'date_desc').range,
    ).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
    expect(toTxnFilter(EMPTY_FILTER, TODAY, '  ', 'date_desc')).toMatchObject({
      range: undefined,
      search: undefined,
      categoryIds: undefined,
    });
  });

  test('active filter count', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(
      activeFilterCount({
        type: 'expense',
        categoryIds: ['a', 'b'],
        paymentMethods: ['cash'],
        period: 'this_month',
      }),
    ).toBe(5);
  });
});

describe('transaction form schema', () => {
  const valid = {
    ...emptyFormValues('expense', TODAY),
    amountText: '1,250.50',
    categoryId: 'cat-1',
  };

  test('valid values become a NewTransaction in paise', () => {
    expect(transactionFormSchema.safeParse(valid).success).toBe(true);
    expect(toNewTransaction(valid)).toMatchObject({
      amountPaise: 125050,
      categoryId: 'cat-1',
      txnDate: TODAY,
    });
  });

  test.each([
    [{ amountText: '' }, 'amountText', 'amount.required'],
    [{ amountText: '0' }, 'amountText', 'amount.zero'],
    [{ amountText: '1.234' }, 'amountText', 'amount.decimals'],
    [{ categoryId: '' }, 'categoryId', 'category.required'],
    [{ txnDate: '2026-02-30' }, 'txnDate', 'date.invalid'],
    [{ description: 'x'.repeat(101) }, 'description', 'description.max'],
  ])('%p → %s %s', (patch, path, message) => {
    const result = transactionFormSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [path], message })]),
    );
  });

  test('form values round-trip', () => {
    const t = toNewTransaction(valid);
    expect(toNewTransaction(toFormValues(t))).toEqual(t);
  });
});
