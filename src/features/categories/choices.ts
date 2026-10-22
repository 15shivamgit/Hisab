// Fixed icon set and colours for the category picker (CATEGORIES.md). Every icon is a
// Material Symbols name checked against expo-symbols in a test.

import { categoryColors, type CategoryColorToken } from '@/theme/tokens';

export const CATEGORY_ICON_CHOICES = [
  'restaurant',
  'lunch_dining',
  'local_cafe',
  'shopping_cart',
  'shopping_bag',
  'checkroom',
  'directions_bus',
  'directions_car',
  'two_wheeler',
  'local_gas_station',
  'train',
  'flight',
  'home',
  'apartment',
  'bolt',
  'water_drop',
  'smartphone',
  'wifi',
  'medical_services',
  'local_pharmacy',
  'fitness_center',
  'school',
  'menu_book',
  'movie',
  'sports_esports',
  'music_note',
  'groups',
  'child_care',
  'pets',
  'card_giftcard',
  'volunteer_activism',
  'spa',
  'build',
  'local_laundry_service',
  'celebration',
  'savings',
  'work',
  'laptop',
  'account_balance_wallet',
  'currency_exchange',
  'payments',
  'account_balance',
  'sell',
  'more_horiz',
] as const;

export const CATEGORY_COLOR_CHOICES = Object.keys(categoryColors) as CategoryColorToken[];

/** Defaults for a quick-created category from the transaction form. */
export const DEFAULT_NEW_CATEGORY = { icon: 'sell', color: 'cat.slate' } as const;
