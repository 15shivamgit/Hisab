import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { resolveScheme, ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { colors } from '@/theme/tokens';

describe('resolveScheme', () => {
  test('system preference follows the device', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  test('system preference falls back to light when the device reports nothing', () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
  });

  test('explicit preference wins over the device', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});

function Probe() {
  const theme = useTheme();
  return <Text>{`${theme.scheme} ${theme.colors.primary}`}</Text>;
}

test('provides the colours of the chosen scheme', async () => {
  const { getByText } = await render(
    <ThemeProvider preference="dark">
      <Probe />
    </ThemeProvider>,
  );
  expect(getByText(`dark ${colors.dark.primary}`)).toBeTruthy();
});
