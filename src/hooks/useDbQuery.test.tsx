import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { notifyChanged } from '@/db/changes';
import { categoryRepository } from '@/db/repositories/categoryRepository';
import { DatabaseProvider } from '@/hooks/DatabaseContext';
import { useDbQuery } from '@/hooks/useDbQuery';
import { AppError } from '@/lib/errors';
import { createTestDb, TEST_NOW } from '@/test/testDb';

async function setup() {
  const db = await createTestDb();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DatabaseProvider db={db}>{children}</DatabaseProvider>
  );
  return { db, wrapper };
}

test('loads, then refreshes when a listed table changes', async () => {
  const { db, wrapper } = await setup();
  let calls = 0;
  const { result } = await renderHook(
    () =>
      useDbQuery(
        async (client) => {
          calls++;
          return (await categoryRepository.list(client, { type: 'income' })).length;
        },
        [],
        { tables: ['categories'] },
      ),
    { wrapper },
  );

  await waitFor(() => expect(result.current.status).toBe('success'));
  expect(result.current.data).toBe(6);

  await categoryRepository.create(
    db,
    { name: 'Rent received', type: 'income', icon: 'home', color: 'cat.green' },
    TEST_NOW,
  );
  await act(async () => notifyChanged(['categories']));
  await waitFor(() => expect(result.current.data).toBe(7));

  const before = calls;
  await act(async () => notifyChanged(['transactions']));
  expect(calls).toBe(before);
});

test('reports errors as AppError', async () => {
  const { wrapper } = await setup();
  const { result } = await renderHook(
    () =>
      useDbQuery(
        async () => {
          throw new AppError('NOT_FOUND', 'gone');
        },
        [],
        { tables: ['transactions'] },
      ),
    { wrapper },
  );
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.error?.code).toBe('NOT_FOUND');
});

test('re-runs when deps change', async () => {
  const { wrapper } = await setup();
  const { result, rerender } = await renderHook(
    ({ type }: { type: 'income' | 'expense' }) =>
      useDbQuery(
        async (client) => (await categoryRepository.list(client, { type })).length,
        [type],
        { tables: ['categories'] },
      ),
    { wrapper, initialProps: { type: 'income' } as { type: 'income' | 'expense' } },
  );
  await waitFor(() => expect(result.current.data).toBe(6));
  await rerender({ type: 'expense' });
  await waitFor(() => expect(result.current.data).toBe(15));
});
