// Budget progress (BUDGETS.md § Progress states, FINANCIAL_RULES.md §5). Integer paise only.

import type { Paise } from '@/lib/money';

export type BudgetState = 'normal' | 'warning' | 'over';

export interface BudgetProgress {
  /** Whole percent, rounded down (7,999 of 10,000 → 79). */
  percent: number;
  /** budget − spent; negative when over. */
  remainingPaise: Paise;
  state: BudgetState;
}

export const WARNING_PERCENT = 80;

/** Normal < 80%; warning 80% … 100% (inclusive); over > 100%. */
export function budgetProgress(spentPaise: Paise, budgetPaise: Paise): BudgetProgress {
  if (!Number.isInteger(spentPaise) || !Number.isInteger(budgetPaise) || budgetPaise <= 0) {
    throw new Error('budgetProgress expects integer paise and a positive budget');
  }
  // Compare in integers: spent * 100 ≥ budget * 80, never with floats.
  const state: BudgetState =
    spentPaise > budgetPaise
      ? 'over'
      : spentPaise * 100 >= budgetPaise * WARNING_PERCENT
        ? 'warning'
        : 'normal';
  return {
    percent: Math.floor((spentPaise * 100) / budgetPaise),
    remainingPaise: budgetPaise - spentPaise,
    state,
  };
}
