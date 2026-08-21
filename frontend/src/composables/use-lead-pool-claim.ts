// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * use-lead-pool-claim.ts — Phase 2 Data Pool tự phục vụ 2026-08-21.
 *
 * Quota realtime + claim action. Lắng socket 'lead_pool:claimed' theo mẫu
 * use-friend-socket.ts để badge cập nhật khi sale khác trong org claim lead.
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { type Socket } from 'socket.io-client';
import { createAppSocket } from '@/api/socket';
import { api } from '@/api';

export interface LeadPoolQuota {
  claimed: number;
  max: number;
  bonusApplied: number;
  remaining: number;
}

export interface ClaimedLead {
  contactId: string;
  fullName: string | null;
  phone: string | null;
  source: string | null;
}

interface LeadPoolClaimedPayload {
  userId: string;
  claimed: number;
  max: number;
}

let socket: Socket | null = null;

function ensureSocket(): Socket {
  if (!socket) socket = createAppSocket();
  return socket;
}

export function useLeadPoolClaim() {
  const quota = ref<LeadPoolQuota | null>(null);
  const claiming = ref(false);
  const error = ref<string | null>(null);

  async function fetchQuota(): Promise<void> {
    try {
      const { data } = await api.get<LeadPoolQuota>('/lead-pool/quota');
      quota.value = data;
    } catch {
      // giữ giá trị cũ nếu load lỗi
    }
  }

  async function claim(): Promise<ClaimedLead | null> {
    claiming.value = true;
    error.value = null;
    try {
      const { data } = await api.post<{ lead: ClaimedLead; quota: LeadPoolQuota }>('/lead-pool/claim');
      quota.value = data.quota;
      return data.lead;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      error.value = e.response?.data?.error || 'Không thể bốc lead lúc này';
      return null;
    } finally {
      claiming.value = false;
    }
  }

  function onSocketClaimed(payload: LeadPoolClaimedPayload) {
    if (quota.value) {
      quota.value = { ...quota.value, claimed: payload.claimed, max: payload.max, remaining: Math.max(0, payload.max - payload.claimed) };
    }
  }

  onMounted(() => {
    void fetchQuota();
    ensureSocket().on('lead_pool:claimed', onSocketClaimed);
  });
  onUnmounted(() => {
    if (socket) socket.off('lead_pool:claimed', onSocketClaimed);
  });

  return { quota, claiming, error, fetchQuota, claim };
}
