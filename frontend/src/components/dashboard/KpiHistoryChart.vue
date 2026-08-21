<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  KpiHistoryChart — Phase 5 Báo cáo KPI 30 ngày 2026-08-21.
  Biểu đồ cột lịch sử KPI: xanh=Đạt, đỏ=Chưa đạt, xám=Không có dữ liệu.
-->
<template>
  <v-card>
    <v-card-title class="text-body-1">Lịch sử KPI {{ days }} ngày</v-card-title>
    <v-card-text>
      <Bar v-if="chartData" :data="chartData" :options="chartOptions" style="height: 260px;" />
      <div v-else class="text-center pa-8 text-grey">Không có dữ liệu</div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export interface KpiHistoryPoint {
  date: string;
  count: number;
  achieved: boolean | null; // null = không có dữ liệu
}

const props = defineProps<{
  history: KpiHistoryPoint[];
  dailyTaskTarget: number;
}>();

const days = computed(() => props.history?.length ?? 0);

const COLOR_ACHIEVED = '#16a34a';
const COLOR_MISSED = '#dc2626';
const COLOR_NO_DATA = '#cbd5e1';

const chartData = computed(() => {
  if (!props.history?.length) return null;
  return {
    labels: props.history.map((h) => h.date.slice(5)), // MM-DD
    datasets: [
      {
        label: `Task/ngày (mục tiêu ${props.dailyTaskTarget})`,
        data: props.history.map((h) => h.count),
        backgroundColor: props.history.map((h) =>
          h.achieved === null ? COLOR_NO_DATA : h.achieved ? COLOR_ACHIEVED : COLOR_MISSED,
        ),
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
};
</script>
