// A photo taken just before Android killed Hisaab (low memory while the camera was open)
// comes back once on the next start (RECEIPTS.md § Sources). The tabs layout checks for it
// and opens a new expense; the form then takes the photo from here.

import type { Picker, PickResult } from '@/platform/picker';

let checked = false;
let waiting: PickResult | null = null;

export const pendingPhoto = {
  /** Checks once per app start. True when a photo is waiting for the new-entry form. */
  async recover(picker: Picker): Promise<boolean> {
    if (checked) return false;
    checked = true;
    const result = await picker.pendingResult();
    if (result?.status !== 'picked') return false;
    waiting = result;
    return true;
  },

  /** Hands the waiting photo to the form, once. */
  take(): PickResult | null {
    const result = waiting;
    waiting = null;
    return result;
  },

  /** Tests only. */
  reset() {
    checked = false;
    waiting = null;
  },
};
