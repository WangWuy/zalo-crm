// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * use-shift-report.ts — Phase 1 Ca làm việc & Báo cáo ca 2026-08-21.
 *
 * Fetch /shifts/current, tính countdown client-side bằng setInterval 1s
 * (không gọi API mỗi giây). Cảnh báo theo alertMinutesBefore xử lý ở caller
 * (ShiftDeadlineWidget) qua watch(remainingMs).
 */
import { ref, computed, onUnmounted } from 'vue';
import { api } from '@/api';

export interface CurrentShift {
  id: string;
  name: string;
  deadlineAt: string; // ISO
  alertMinutesBefore: number[];
}

export function useShiftReport() {
  const shift = ref<CurrentShift | null>(null);
  const hasSubmittedToday = ref(false);
  const loading = ref(false);
  const nowMs = ref(Date.now());
  let tickHandle: ReturnType<typeof setInterval> | null = null;

  function startTicking() {
    if (tickHandle) return;
    tickHandle = setInterval(() => {
      nowMs.value = Date.now();
    }, 1000);
  }
  function stopTicking() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  async function fetchCurrent() {
    loading.value = true;
    try {
      const res = await api.get('/shifts/current');
      shift.value = res.data.shift;
      hasSubmittedToday.value = !!res.data.hasSubmittedToday;
      if (shift.value) startTicking();
      else stopTicking();
    } catch (err) {
      console.error('[use-shift-report] fetchCurrent error:', err);
      shift.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function submitReport(payload: { metrics?: Record<string, unknown>; note?: string }) {
    const res = await api.post('/shifts/reports', payload);
    hasSubmittedToday.value = true;
    return res.data.report;
  }

  const remainingMs = computed(() => {
    if (!shift.value) return null;
    return new Date(shift.value.deadlineAt).getTime() - nowMs.value;
  });

  const isOverdue = computed(() => (remainingMs.value ?? 0) < 0);

  const formattedCountdown = computed(() => {
    if (remainingMs.value == null) return '';
    const ms = Math.abs(remainingMs.value);
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const sign = isOverdue.value ? '-' : '';
    return h > 0 ? `${sign}${h}h${String(m).padStart(2, '0')}m` : `${sign}${m}m`;
  });

  onUnmounted(stopTicking);

  return {
    shift,
    hasSubmittedToday,
    loading,
    remainingMs,
    isOverdue,
    formattedCountdown,
    fetchCurrent,
    submitReport,
  };
}
