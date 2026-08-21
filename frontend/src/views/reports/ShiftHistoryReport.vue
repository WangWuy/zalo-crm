<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  ShiftHistoryReport — Lịch sử báo cáo ca. Phase 1 Ca làm việc & Báo cáo ca 2026-08-21.
  Endpoint GET /shifts/reports. RBAC scope theo getOwnerScope (server-side).
-->
<template>
  <div class="rpt">
    <div class="rpt-head">
      <div class="rpt-titles">
        <div class="ic"><v-icon icon="mdi-clock-check-outline" /></div>
        <div>
          <div class="rpt-h1">Báo cáo ca</div>
          <div class="rpt-sub">Lịch sử báo cáo ca/ngày của sale — trễ hạn được đánh dấu riêng.</div>
        </div>
      </div>
      <div class="rpt-actions">
        <button class="rk-btn ghost" :disabled="loading" @click="load">
          <v-icon icon="mdi-refresh" size="16" /> Làm mới
        </button>
      </div>
    </div>

    <div class="rpt-filters">
      <div class="seg">
        <button v-for="r in ranges" :key="r.key" :class="{ on: range === r.key }" @click="range = r.key">
          {{ r.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="rk-loading">
      <v-icon icon="mdi-loading" class="mdi-spin" /> Đang tải dữ liệu…
    </div>

    <template v-else>
      <div class="grid g-4" style="margin-bottom:18px">
        <div class="kpi">
          <div class="top"><span class="label">Tổng báo cáo</span></div>
          <div class="val">{{ reports.length }}</div>
        </div>
        <div class="kpi accent-ok">
          <div class="top"><span class="label">Đúng hạn</span></div>
          <div class="val">{{ onTimeCount }}</div>
        </div>
        <div class="kpi">
          <div class="top"><span class="label">Trễ hạn</span></div>
          <div class="val">{{ lateCount }}</div>
        </div>
      </div>

      <!-- Phase 5 Báo cáo KPI 30 ngày 2026-08-21 -->
      <div v-if="kpiHistory" class="grid g-4" style="margin-bottom:18px">
        <div class="kpi">
          <div class="top"><span class="label">TB task/ngày</span></div>
          <div class="val">{{ kpiHistory.summary.avgPerDay }}</div>
        </div>
        <div class="kpi accent-ok">
          <div class="top"><span class="label">Số ngày đạt KPI</span></div>
          <div class="val">{{ kpiHistory.summary.achievedDays }}<span class="u">/ {{ kpiHistory.summary.totalDaysWithData }}</span></div>
        </div>
        <div class="kpi">
          <div class="top"><span class="label">Xu hướng</span></div>
          <div class="val">
            <template v-if="kpiHistory.summary.trendPct != null">
              {{ kpiHistory.summary.trendPct > 0 ? '+' : '' }}{{ kpiHistory.summary.trendPct }}%
            </template>
            <template v-else>—</template>
          </div>
        </div>
      </div>
      <KpiHistoryChart
        v-if="kpiHistory"
        :history="kpiHistory.history"
        :daily-task-target="kpiHistory.dailyTaskTarget"
        style="margin-bottom:18px"
      />

      <div class="card">
        <div class="card-h"><div class="t">Danh sách báo cáo</div></div>
        <div class="card-b" style="padding:0">
          <table v-if="reports.length" class="tbl">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Sale</th>
                <th>Ca</th>
                <th class="num">Lead mới</th>
                <th class="num">Tin gửi</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in reports" :key="r.id">
                <td>{{ r.reportDate }}</td>
                <td>{{ r.user?.fullName ?? '—' }}</td>
                <td>{{ r.shift?.name ?? '—' }}</td>
                <td class="num">{{ r.metrics?.newLeads ?? 0 }}</td>
                <td class="num">{{ r.metrics?.sent ?? 0 }}</td>
                <td><span class="pill" :class="r.isLate ? 'danger' : 'ok'">{{ r.isLate ? 'Trễ hạn' : 'Đúng hạn' }}</span></td>
                <td class="sub">{{ r.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="rk-empty">Chưa có báo cáo ca nào trong kỳ này.</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '@/api';
import KpiHistoryChart, { type KpiHistoryPoint } from '@/components/dashboard/KpiHistoryChart.vue';

interface ShiftReportRow {
  id: string;
  reportDate: string;
  isLate: boolean;
  note: string | null;
  metrics: { newLeads?: number; sent?: number; replied?: number; closedThisMonth?: number };
  user?: { id: string; fullName: string };
  shift?: { id: string; name: string } | null;
}

interface KpiHistoryResponse {
  dailyTaskTarget: number;
  history: KpiHistoryPoint[];
  summary: { avgPerDay: number; achievedDays: number; totalDaysWithData: number; trendPct: number | null };
}

const ranges = [
  { key: '7d', label: '7 ngày', days: 7 },
  { key: '30d', label: '30 ngày', days: 30 },
  { key: 'quarter', label: 'Quý', days: 90 },
] as const;

const reports = ref<ShiftReportRow[]>([]);
const kpiHistory = ref<KpiHistoryResponse | null>(null);
const loading = ref(true);
const range = ref<string>('30d');
const onTimeCount = ref(0);
const lateCount = ref(0);

function dateRange(): { from: string; to: string } {
  const days = ranges.find((r) => r.key === range.value)?.days ?? 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

async function load() {
  loading.value = true;
  try {
    const { from, to } = dateRange();
    const days = ranges.find((r) => r.key === range.value)?.days ?? 30;
    const [reportsRes, kpiRes] = await Promise.allSettled([
      api.get('/shifts/reports', { params: { from, to } }),
      api.get('/reports/kpi-history', { params: { days } }),
    ]);
    reports.value = reportsRes.status === 'fulfilled' ? (reportsRes.value.data.reports ?? []) : [];
    lateCount.value = reports.value.filter((r) => r.isLate).length;
    onTimeCount.value = reports.value.length - lateCount.value;
    kpiHistory.value = kpiRes.status === 'fulfilled' ? kpiRes.value.data : null;
    if (reportsRes.status === 'rejected') console.error('[ShiftHistoryReport] reports load failed', reportsRes.reason);
    if (kpiRes.status === 'rejected') console.error('[ShiftHistoryReport] kpi-history load failed', kpiRes.reason);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(range, load);
</script>
