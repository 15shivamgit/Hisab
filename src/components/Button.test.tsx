import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '@/components/Button';
import { ThemeProvider } from '@/theme/ThemeProvider';

async function renderButton(props: Partial<Parameters<typeof Button>[0]> = {}) {
  const onPress = jest.fn();
  const utils = await render(
    <ThemeProvider>
      <Button label="Save" onPress={onPress} {...props} />
    </ThemeProvider>,
  );
  return { onPress, ...utils };
}

test('shows its label and calls onPress', async () => {
  const { getByRole, onPress } = await renderButton();
  await fireEvent.press(getByRole('button', { name: 'Save' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('does not fire while loading and reports busy', async () => {
  const { getByRole, queryByText, onPress } = await renderButton({ loading: true });
  const button = getByRole('button', { name: 'Save' });
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  expect(queryByText('Save')).toBeNull();
});

test('does not fire when disabled', async () => {
  const { getByRole, onPress } = await renderButton({ disabled: true });
  await fireEvent.press(getByRole('button', { name: 'Save' }));
  expect(onPress).not.toHaveBeenCalled();
});
