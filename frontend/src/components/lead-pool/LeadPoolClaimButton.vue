<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Nguyễn Tiến Lộc -->
<!--
  LeadPoolClaimButton.vue — Phase 2 Data Pool tự phục vụ 2026-08-21.

  Thay thế @ee/lead-pool/components/LeadFloatingButton.vue (stub Community
  edition, không làm gì) trong ConversationFilterSidebar.vue. Giữ đúng class
  contract (.lfb-wrap/.lfb-btn/.lfb-icon/.lfb-badge/.lfb-text/.lfb-pending-*)
  vì sidebar có sẵn CSS :deep() nhắm vào các class này (collapsed 44×44 mode).
-->
<template>
  <div class="lfb-wrap">
    <button class="lfb-btn" :class="{ disabled: !canClaim }" :disabled="claiming || !canClaim" @click="onClaim" title="Nhận khách mới từ pool">
      <span class="lfb-icon">🎁</span>
      <span v-if="!inline" class="lfb-text">Nhận khách</span>
      <span v-if="quota" class="lfb-badge">{{ quota.claimed }}/{{ quota.max }}</span>
    </button>
    <div v-if="!inline && lastClaimed" class="lfb-pending-info">
      <span class="lfb-pending-countdown">{{ lastClaimedLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLeadPoolClaim, type ClaimedLead } from '@/composables/use-lead-pool-claim';
import { sourceBadge } from '@/lib/source-badge';
import { useToast } from '@/composables/use-toast';

defineProps<{ inline?: boolean }>();

const { quota, claiming, error, claim } = useLeadPoolClaim();
const toast = useToast();
const lastClaimed = ref<ClaimedLead | null>(null);

const canClaim = computed(() => !quota.value || quota.value.remaining > 0);
const lastClaimedLabel = computed(() => {
  if (!lastClaimed.value) return '';
  const badge = sourceBadge(lastClaimed.value.source);
  return `${badge.icon} ${lastClaimed.value.fullName || lastClaimed.value.phone || 'Khách mới'}`;
});

async function onClaim() {
  if (!canClaim.value || claiming.value) return;
  const lead = await claim();
  if (lead) {
    lastClaimed.value = lead;
    toast.success(`Đã nhận khách: ${lead.fullName || lead.phone || 'Khách mới'}`);
  } else if (error.value) {
    toast.error(error.value);
  }
}
</script>

<style scoped>
.lfb-wrap { display: flex; flex-direction: column; align-items: stretch; width: 100%; gap: 4px; }
.lfb-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #f59e0b, #dc2626); color: #fff;
  font-size: 13px; font-weight: 700; cursor: pointer; position: relative;
  width: 100%; justify-content: center;
}
.lfb-btn:hover:not(:disabled) { filter: brightness(1.05); }
.lfb-btn:disabled, .lfb-btn.disabled { opacity: .55; cursor: default; }
.lfb-icon { font-size: 16px; }
.lfb-text { white-space: nowrap; }
.lfb-badge {
  background: rgba(255,255,255,.25); border-radius: 999px;
  padding: 1px 7px; font-size: 11px; font-weight: 800;
}
.lfb-pending-info { font-size: 11px; color: #6b7488; text-align: center; }
.lfb-pending-countdown { display: inline-block; }
</style>
