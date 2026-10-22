import {
  CATEGORY_COLOR_CHOICES,
  CATEGORY_ICON_CHOICES,
  DEFAULT_NEW_CATEGORY,
} from '@/features/categories/choices';

test('every icon in the picker exists in the installed Material Symbols list', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
  const path = jest.requireActual<typeof import('node:path')>('node:path');
  const symbols = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'node_modules/expo-symbols/src/android/symbols.json'),
      'utf8',
    ),
  ) as Record<string, number>;
  const icons = [...CATEGORY_ICON_CHOICES, DEFAULT_NEW_CATEGORY.icon];
  expect(icons.filter((icon) => !(icon in symbols))).toEqual([]);
  expect(new Set(CATEGORY_ICON_CHOICES).size).toBe(CATEGORY_ICON_CHOICES.length);
});

test('default colour is one of the choices', () => {
  expect(CATEGORY_COLOR_CHOICES).toContain(DEFAULT_NEW_CATEGORY.color);
});
