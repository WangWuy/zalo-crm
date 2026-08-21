// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
import { ref } from 'vue';
import { getUserPreference, setUserPreference } from './use-user-preference';

export const DIALER_PREFERENCE_KEY = 'dialer.method';

export interface DialerPreference {
  method: 'tel' | 'custom';
  customUriScheme?: string;
}

const DEFAULT_PREFERENCE: DialerPreference = { method: 'tel' };

const preference = ref<DialerPreference>(DEFAULT_PREFERENCE);
let loaded = false;

export function useDialer() {
  async function load(): Promise<DialerPreference> {
    const value = await getUserPreference<DialerPreference>(DIALER_PREFERENCE_KEY, DEFAULT_PREFERENCE);
    preference.value = value;
    loaded = true;
    return value;
  }

  async function save(next: DialerPreference): Promise<void> {
    await setUserPreference(DIALER_PREFERENCE_KEY, next);
    preference.value = next;
  }

  function buildCallHref(phone: string): string {
    const pref = preference.value;
    if (pref.method === 'custom' && pref.customUriScheme) {
      return `${pref.customUriScheme}${phone}`;
    }
    return `tel:${phone}`;
  }

  function triggerCall(phone: string): void {
    if (!phone) return;
    window.location.href = buildCallHref(phone);
  }

  if (!loaded) {
    loaded = true;
    void load();
  }

  return { preference, load, save, buildCallHref, triggerCall };
}
