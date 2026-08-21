<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  ShiftDeadlineWidget — Phase 1 Ca làm việc & Báo cáo ca 2026-08-21.
  Đồng hồ đếm ngược deadline nộp báo cáo ca kiểu TheLab. Bấm mở form nộp báo cáo.
-->
<template>
  <div v-if="shift" class="sdw" :class="bannerClass">
    <Clock :size="15" :stroke-width="2" />
    <span class="sdw__label">
      <template v-if="hasSubmittedToday">Đã nộp báo cáo ca "{{ shift.name }}"</template>
      <template v-else-if="isOverdue">Trễ báo cáo ca "{{ shift.name }}"</template>
      <template v-else>Deadline báo cáo ca "{{ shift.name }}"</template>
    </span>
    <span v-if="!hasSubmittedToday" class="sdw__time">{{ formattedCountdown }}</span>
    <CircleCheck v-if="hasSubmittedToday" :size="15" :stroke-width="2" />
    <button v-else class="sdw__btn" @click="dialogOpen = true">Nộp báo cáo</button>
  </div>

  <ShiftReportFormDialog
    v-if="dialogOpen"
    :shift-name="shift?.name ?? ''"
    @close="dialogOpen = false"
    @submitted="onSubmitted"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Clock, CircleCheck } from 'lucide-vue-next';
import { useShiftReport } from '@/composables/use-shift-report';
import { useToast } from '@/composables/use-toast';
import ShiftReportFormDialog from './ShiftReportFormDialog.vue';

const { shift, hasSubmittedToday, remainingMs, isOverdue, formattedCountdown, fetchCurrent } = useShiftReport();
const toast = useToast();
const dialogOpen = ref(false);

const bannerClass = computed(() => {
  if (hasSubmittedToday.value) return 'sdw--ok';
  if (isOverdue.value) return 'sdw--danger';
  const min = (remainingMs.value ?? Infinity) / 60000;
  const alerts = shift.value?.alertMinutesBefore ?? [30, 15];
  const nearest = Math.min(...alerts);
  return min <= nearest ? 'sdw--warn' : 'sdw--info';
});

// Cảnh báo khi chạm mốc alertMinutesBefore (vd 30p/15p trước deadline).
const alertedAt = new Set<number>();
watch(remainingMs, (ms) => {
  if (ms == null || hasSubmittedToday.value) return;
  const min = Math.floor(ms / 60000);
  const alerts = shift.value?.alertMinutesBefore ?? [];
  for (const a of alerts) {
    if (min === a && !alertedAt.has(a)) {
      alertedAt.add(a);
      toast.warning(`Còn ${a} phút tới deadline báo cáo ca "${shift.value?.name}"`);
    }
  }
});

function onSubmitted() {
  dialogOpen.value = false;
  toast.success('Đã nộp báo cáo ca');
  fetchCurrent();
}

onMounted(fetchCurrent);
</script>

<style scoped>
.sdw {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: var(--at-r-md, 9px);
  border: 1px solid var(--at-hairline);
  font-size: 12px;
  margin-bottom: 12px;
  background: var(--at-surface-soft);
  color: var(--at-body);
}
.sdw--ok { border-color: var(--at-atlas-success); color: var(--at-atlas-success); }
.sdw--warn { background: var(--at-atlas-warning-soft); border-color: #fcd34d; color: #92400e; }
.sdw--danger { background: var(--at-atlas-danger); color: #fff; border-color: var(--at-atlas-danger); }
.sdw__label { font-weight: 600; }
.sdw__time { font-variant-numeric: tabular-nums; font-weight: 700; }
.sdw__btn {
  margin-left: auto;
  border: none;
  background: var(--at-action);
  color: #fff;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.sdw--danger .sdw__btn { background: #fff; color: var(--at-atlas-danger); }
</style>
