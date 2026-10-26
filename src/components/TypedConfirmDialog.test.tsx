import { fireEvent, render } from '@testing-library/react-native';

import { TypedConfirmDialog } from '@/components/TypedConfirmDialog';
import { TestProviders } from '@/test/TestProviders';

async function renderDialog(extra?: { label: string; onPress: () => void }) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const utils = await render(
    <TestProviders>
      <TypedConfirmDialog
        visible
        title="Delete all data?"
        body="Type DELETE to continue."
        word="DELETE"
        confirmLabel="Delete everything"
        onConfirm={onConfirm}
        onCancel={onCancel}
        extra={extra}
      />
    </TestProviders>,
  );
  return { onConfirm, onCancel, ...utils };
}

test('the confirm button works only after the word is typed', async () => {
  const { getByRole, getByLabelText, onConfirm } = await renderDialog();
  const confirm = getByRole('button', { name: 'Delete everything' });

  await fireEvent.press(confirm);
  await fireEvent.changeText(getByLabelText('Type DELETE'), 'delet');
  await fireEvent.press(confirm);
  expect(onConfirm).not.toHaveBeenCalled();

  await fireEvent.changeText(getByLabelText('Type DELETE'), ' delete ');
  await fireEvent.press(getByRole('button', { name: 'Delete everything' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('cancel and the extra action', async () => {
  const backupFirst = jest.fn();
  const { getByRole, onCancel } = await renderDialog({
    label: 'Create backup first',
    onPress: backupFirst,
  });
  await fireEvent.press(getByRole('button', { name: 'Create backup first' }));
  expect(backupFirst).toHaveBeenCalledTimes(1);
  await fireEvent.press(getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
