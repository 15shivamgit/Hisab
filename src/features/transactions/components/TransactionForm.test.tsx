import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { Category } from '@/db/types';
import {
  TransactionForm,
  type TransactionFormProps,
} from '@/features/transactions/components/TransactionForm';
import { emptyFormValues } from '@/features/transactions/schema';
import { TestProviders } from '@/test/TestProviders';

const TODAY = '2026-10-21';

function category(
  id: string,
  name: string,
  type: 'income' | 'expense',
  extra: Partial<Category> = {},
): Category {
  return {
    id,
    name,
    type,
    icon: 'restaurant',
    color: 'cat.orange',
    isSystem: false,
    sortOrder: 0,
    archivedAt: null,
    createdAt: 'x',
    updatedAt: 'x',
    ...extra,
  };
}

const categories = [
  category('food', 'Food', 'expense', { sortOrder: 0 }),
  category('rent', 'Rent', 'expense', { sortOrder: 1 }),
  category('old', 'Old', 'expense', { sortOrder: 2, archivedAt: '2026-01-01T00:00:00.000Z' }),
  category('salary', 'Salary', 'income'),
];

async function renderForm(props: Partial<TransactionFormProps> = {}) {
  const onSubmit = jest.fn(async () => undefined);
  const utils = await render(
    <TestProviders>
      <TransactionForm
        initialValues={emptyFormValues('expense', TODAY)}
        categories={categories}
        recentCategoryIds={{ expense: ['rent'], income: [] }}
        today={TODAY}
        submitLabel="Save"
        onSubmit={onSubmit}
        onCreateCategory={jest.fn()}
        {...props}
      />
    </TestProviders>,
  );
  return { ...utils, onSubmit };
}

test('saving an empty form shows inline errors and does not submit (TXN-09)', async () => {
  const { getByTestId, findByText, onSubmit } = await renderForm();
  await fireEvent.press(getByTestId('save-button'));
  // Generous timeout: validation is async and the machine may be busy (seen flaky at 1 s).
  expect(await findByText('Enter an amount', {}, { timeout: 5000 })).toBeTruthy();
  expect(await findByText('Choose a category', {}, { timeout: 5000 })).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('archived categories are hidden; last-used comes first', async () => {
  const { queryByTestId, getAllByRole } = await renderForm();
  expect(queryByTestId('category-chip-Old')).toBeNull();
  const labels = getAllByRole('radio').map((el) => el.props.accessibilityLabel);
  expect(labels.indexOf('Rent')).toBeLessThan(labels.indexOf('Food'));
});

test('submits the typed values; amount is grouped while typing', async () => {
  const { getByTestId, onSubmit } = await renderForm();
  await fireEvent.changeText(getByTestId('amount-input'), '125050');
  expect(getByTestId('amount-input').props.value).toBe('1,25,050');
  await fireEvent.press(getByTestId('category-chip-Food'));
  await fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'expense',
      amountText: '1,25,050',
      categoryId: 'food',
      txnDate: TODAY,
    }),
  );
});

test('switching type clears a category of the other type', async () => {
  const { getByTestId, getByRole, findByText } = await renderForm();
  await fireEvent.press(getByTestId('category-chip-Food'));
  await fireEvent.press(getByRole('radio', { name: 'Income' }));
  await fireEvent.changeText(getByTestId('amount-input'), '100');
  await fireEvent.press(getByTestId('save-button'));
  expect(await findByText('Choose a category')).toBeTruthy();
});

test('a future date shows when it will be counted (TXN-08)', async () => {
  const { getByTestId } = await renderForm({
    initialValues: { ...emptyFormValues('expense', TODAY), txnDate: '2026-10-25' },
  });
  expect(getByTestId('future-hint').props.children).toBe('This will be counted on 25 Oct');
});

test('an archived category stays visible when editing an entry that uses it', async () => {
  const { getByTestId } = await renderForm({
    initialValues: { ...emptyFormValues('expense', TODAY), categoryId: 'old', amountText: '10' },
  });
  expect(getByTestId('category-chip-Old')).toBeTruthy();
});
