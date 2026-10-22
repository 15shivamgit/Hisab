// Default categories (docs/07-content/DEFAULT_CATEGORIES.md). Icons are Material Symbols
// names; a test checks each one exists in the installed expo-symbols list.

import type { TxnType } from '@/db/types';

export interface DefaultCategory {
  name: string;
  type: TxnType;
  icon: string;
  color: string;
  isSystem?: boolean;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Food & Dining', type: 'expense', icon: 'restaurant', color: 'cat.orange' },
  { name: 'Groceries', type: 'expense', icon: 'shopping_cart', color: 'cat.green' },
  { name: 'Transport', type: 'expense', icon: 'directions_bus', color: 'cat.blue' },
  { name: 'Fuel', type: 'expense', icon: 'local_gas_station', color: 'cat.amber' },
  { name: 'Rent', type: 'expense', icon: 'home', color: 'cat.indigo' },
  { name: 'Bills & Recharge', type: 'expense', icon: 'smartphone', color: 'cat.teal' },
  { name: 'Shopping', type: 'expense', icon: 'shopping_bag', color: 'cat.pink' },
  { name: 'Health', type: 'expense', icon: 'medical_services', color: 'cat.red' },
  { name: 'Education', type: 'expense', icon: 'school', color: 'cat.purple' },
  { name: 'Entertainment', type: 'expense', icon: 'movie', color: 'cat.purple' },
  { name: 'Family', type: 'expense', icon: 'groups', color: 'cat.blue' },
  { name: 'Gifts & Donations', type: 'expense', icon: 'card_giftcard', color: 'cat.pink' },
  { name: 'Travel', type: 'expense', icon: 'flight', color: 'cat.teal' },
  { name: 'Personal Care', type: 'expense', icon: 'spa', color: 'cat.amber' },
  { name: 'Other', type: 'expense', icon: 'more_horiz', color: 'cat.slate', isSystem: true },

  { name: 'Salary', type: 'income', icon: 'work', color: 'cat.green' },
  { name: 'Business / Freelance', type: 'income', icon: 'laptop', color: 'cat.blue' },
  { name: 'Pocket Money', type: 'income', icon: 'account_balance_wallet', color: 'cat.amber' },
  { name: 'Refund', type: 'income', icon: 'currency_exchange', color: 'cat.teal' },
  { name: 'Interest / Gift', type: 'income', icon: 'savings', color: 'cat.purple' },
  { name: 'Other', type: 'income', icon: 'more_horiz', color: 'cat.slate', isSystem: true },
];
