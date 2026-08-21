<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  ShiftReportFormDialog — Phase 1 Ca làm việc & Báo cáo ca 2026-08-21.
  Metrics snapshot lấy tự động từ /dashboard/action-hub/me (interactionToday +
  closedThisMonth) — sale KHÔNG gõ tay số liệu đã có sẵn, chỉ sửa phần diễn giải (note).
  Modal clone pattern ConfirmActionModal.vue (Teleport + overlay + design tokens).
-->
<template>
  <Teleport to="body">
    <div class="srf-overlay" @click.self="onCancel">
      <div class="srf-modal" role="dialog" aria-modal="true">
        <div class="srf-head">
          <div class="srf-head__tx">
            <h2>Nộp báo cáo ca{{ shiftName ? ` "${shiftName}"` : '' }}</h2>
            <p class="srf-sub">Số liệu lấy tự động từ hệ thống — chỉ cần bổ sung ghi chú.</p>
          </div>
          <button class="srf-x" aria-label="Đóng" @click="onCancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div class="srf-body">
          <div v-if="loadingMetrics" class="srf-loading">Đang tải số liệu…</div>
          <div v-else class="srf-metrics">
            <div class="srf-metric"><span class="srf-metric__v">{{ metrics.newLeads }}</span><span class="srf-metric__l">Lead mới</span></div>
            <div class="srf-metric"><span class="srf-metric__v">{{ metrics.sent }}</span><span class="srf-metric__l">Tin đã gửi</span></div>
            <div class="srf-metric"><span class="srf-metric__v">{{ metrics.replied }}</span><span class="srf-metric__l">Đã trả lời</span></div>
            <div class="srf-metric"><span class="srf-metric__v">{{ metrics.closedThisMonth }}</span><span class="srf-metric__l">Chốt (tháng)</span></div>
          </div>

          <label class="srf-label">Diễn giải / ghi chú</label>
          <textarea
            v-model="note"
            class="srf-textarea"
            rows="4"
            placeholder="Ghi chú thêm về ca làm việc (nếu có)..."
          />
        </div>

        <div class="srf-foot">
          <button class="srf-btn srf-btn--ghost" :disabled="submitting" @click="onCancel">Hủy</button>
          <button class="srf-btn srf-btn--primary" :disabled="submitting" @click="onSubmit">
            <span v-if="submitting" class="srf-spin" />
            Nộp báo cáo
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import { useShiftReport } from '@/composables/use-shift-report';

defineProps<{ shiftName: string }>();
const emit = defineEmits<{ close: []; submitted: [] }>();

const { submitReport } = useShiftReport();

const loadingMetrics = ref(true);
const submitting = ref(false);
const note = ref('');
const metrics = ref({ newLeads: 0, sent: 0, replied: 0, closedThisMonth: 0 });

async function loadMetrics() {
  loadingMetrics.value = true;
  try {
    const res = await api.get('/dashboard/action-hub/me');
    const data = res.data;
    metrics.value = {
      newLeads: data?.interactionToday?.newLeads ?? 0,
      sent: data?.interactionToday?.sent ?? 0,
      replied: data?.interactionToday?.replied ?? 0,
      closedThisMonth: data?.kpi?.closedThisMonth ?? 0,
    };
  } catch (err) {
    console.error('[ShiftReportFormDialog] loadMetrics error:', err);
  } finally {
    loadingMetrics.value = false;
  }
}

async function onSubmit() {
  submitting.value = true;
  try {
    await submitReport({ metrics: metrics.value, note: note.value.trim() || undefined });
    emit('submitted');
  } catch (err) {
    console.error('[ShiftReportFormDialog] submit error:', err);
  } finally {
    submitting.value = false;
  }
}

function onCancel() {
  if (submitting.value) return;
  emit('close');
}

onMounted(loadMetrics);
</script>

<style scoped>
.srf-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 26, 36, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}
.srf-modal {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  width: 420px;
  max-width: calc(100vw - 32px);
  box-shadow: var(--sh-lg);
  display: flex;
  flex-direction: column;
}
.srf-head { display: flex; align-items: flex-start; gap: 11px; padding: 16px 16px 12px; }
.srf-head__tx { flex: 1; min-width: 0; }
.srf-head h2 { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); line-height: 1.35; }
.srf-sub { font-size: 12px; color: var(--ink-3); margin-top: 4px; line-height: 1.45; }
.srf-x {
  width: 26px; height: 26px; border-radius: var(--r-sm); border: 0; flex-shrink: 0;
  background: transparent; color: var(--ink-4); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.srf-x:hover { background: var(--surface-3); color: var(--ink); }

.srf-body { padding: 4px 16px 4px; display: flex; flex-direction: column; gap: 12px; }
.srf-loading { font-size: 12.5px; color: var(--ink-3); padding: 8px 0; }
.srf-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.srf-metric {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--surface-3); border-radius: var(--r-sm); padding: 8px 4px;
}
.srf-metric__v { font-size: 16px; font-weight: 700; color: var(--ink); }
.srf-metric__l { font-size: 10.5px; color: var(--ink-3); }

.srf-label { font-size: 11.5px; font-weight: 600; color: var(--ink-2); }
.srf-textarea {
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--line); border-radius: var(--r-sm);
  padding: 8px 10px; font-family: inherit; font-size: 12.5px; color: var(--ink);
  resize: vertical; background: var(--surface);
}
.srf-textarea:focus { outline: none; border-color: var(--brand); }

.srf-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 16px 16px; }
.srf-btn {
  height: 36px; padding: 0 16px; border-radius: var(--r-sm);
  font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  border: 1px solid transparent;
}
.srf-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.srf-btn--ghost { background: var(--surface); border-color: var(--line); color: var(--ink-2); }
.srf-btn--ghost:hover:not(:disabled) { background: var(--surface-3); }
.srf-btn--primary { background: var(--brand); color: #fff; }
.srf-btn--primary:hover:not(:disabled) { background: var(--brand-600); }

.srf-spin {
  width: 13px; height: 13px; border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff; border-radius: 50%; animation: srf-spin 0.7s linear infinite;
}
@keyframes srf-spin { to { transform: rotate(360deg); } }
</style>
