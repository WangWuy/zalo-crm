<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  QuickContactActions — cụm nút thao tác nhanh (Copy SĐT / Gọi / Zalo / Telegram).
  Phase 3 TheLab. Hỗ trợ cả 2 kiểu gọi tel: có sẵn trong codebase:
    - anchor <a href="tel:...">  (LeadDetailPanel.vue)
    - window.location.href = 'tel:...' programmatic (FriendsView.vue onCall())
  Mặc định dùng anchor (đơn giản hơn, không cần JS); truyền `callMode="programmatic"`
  nếu component cha cần chặn navigation mặc định (vd để log trước khi gọi).
-->
<template>
  <div class="qca-row" @click.stop>
    <button class="qca-btn" title="Sao chép số điện thoại" @click="copyPhone">⧉</button>
    <a
      v-if="callMode === 'anchor'"
      class="qca-btn qca-call"
      :href="`tel:${phone}`"
      title="Gọi điện"
    >📞</a>
    <button v-else class="qca-btn qca-call" title="Gọi điện" @click="callProgrammatic">📞</button>
    <a class="qca-btn" :href="`https://zalo.me/${phone}`" target="_blank" rel="noopener" title="Nhắn Zalo">💬</a>
    <a class="qca-btn" :href="`https://t.me/+${phone}`" target="_blank" rel="noopener" title="Nhắn Telegram">✈️</a>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/use-toast';

const props = withDefaults(defineProps<{
  phone: string;
  callMode?: 'anchor' | 'programmatic';
}>(), {
  callMode: 'anchor',
});

const toast = useToast();

async function copyPhone() {
  try {
    await navigator.clipboard.writeText(props.phone);
    toast.success('Đã sao chép số điện thoại');
  } catch {
    toast.error('Không thể sao chép');
  }
}

function callProgrammatic() {
  if (props.phone) window.location.href = `tel:${props.phone}`;
}
</script>

<style scoped>
.qca-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.qca-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--smax-grey-200);
  background: #fff;
  color: var(--smax-grey-700);
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.qca-btn:hover {
  background: var(--smax-primary-soft, #e3f2fd);
  border-color: var(--smax-primary, #2962ff);
}
.qca-call:hover { color: #00897b; border-color: #00897b; }
</style>
