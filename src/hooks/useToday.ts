import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { systemClock, type Clock } from '@/lib/clock';
import { todayLocal, type LocalDate } from '@/lib/dates';

/**
 * Today's local date. Updates when the app returns to the foreground and once a minute,
 * so totals move to the new day after midnight (DASHBOARD.md acceptance).
 */
export function useToday(clock: Clock = systemClock): LocalDate {
  const [today, setToday] = useState(() => todayLocal(clock.now()));
  useEffect(() => {
    const refresh = () => setToday(todayLocal(clock.now()));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [clock]);
  return today;
}
