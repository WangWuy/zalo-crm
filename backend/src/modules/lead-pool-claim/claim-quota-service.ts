// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * claim-quota-service.ts — Phase 2 Data Pool tự phục vụ 2026-08-21.
 *
 * "Bốc lead chủ động": sale bấm claim 1 contact đủ điều kiện từ pool, dùng
 * CHUNG quota với LeadPoolConfig.maxRequestsPerDay (không tách bảng song
 * song — xem implementation_plan.md mục 2.1). Nguồn phân phối mới:
 * LeadPoolDistribution.source = 'new_inbound'.
 *
 * Race condition: nhiều sale bấm claim cùng lúc không được nhận trùng 1
 * contact — dùng `FOR UPDATE SKIP LOCKED` theo đúng mẫu pickPending() ở
 * backend/src/modules/integrations/_shared/webhook-log.service.ts.
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { reportDateVN } from '../shift/shift-schedule-service.js';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function todayRangeVN(): { today: Date; tomorrow: Date } {
  const now = new Date();
  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const todayVN = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate());
  const today = new Date(todayVN.getTime() - VN_OFFSET_MS);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return { today, tomorrow };
}

export interface QuotaStatus {
  claimed: number;
  max: number;
  bonusApplied: number;
  remaining: number;
}

export async function getTodayQuotaStatus(orgId: string, userId: string): Promise<QuotaStatus> {
  const { today, tomorrow } = todayRangeVN();
  const dateKey = reportDateVN();

  const [config, claimed, bonuses] = await Promise.all([
    prisma.leadPoolConfig.findUnique({ where: { orgId }, select: { maxRequestsPerDay: true } }),
    prisma.leadPoolDistribution.count({
      where: { orgId, assignedToUserId: userId, distributedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.leadPoolBonusQuota.aggregate({
      where: { orgId, userId, dateKey },
      _sum: { bonusCount: true },
    }),
  ]);

  const bonusApplied = bonuses._sum.bonusCount ?? 0;
  const max = (config?.maxRequestsPerDay ?? 10) + bonusApplied;
  return { claimed, max, bonusApplied, remaining: Math.max(0, max - claimed) };
}

export class ClaimError extends Error {
  constructor(public code: 'quota_exceeded' | 'pool_empty' | 'pool_disabled', message: string) {
    super(message);
  }
}

interface ClaimedLead {
  contactId: string;
  fullName: string | null;
  phone: string | null;
  source: string | null;
}

/**
 * Bốc 1 contact đủ điều kiện pool nguồn 'new_inbound' cho userId.
 * Transaction: lock 1 row FOR UPDATE SKIP LOCKED → update Contact →
 * insert LeadPoolDistribution → ghi ActivityLog (atomic, rollback cùng nhau).
 */
export async function claimNextLead(orgId: string, userId: string): Promise<ClaimedLead> {
  const config = await prisma.leadPoolConfig.findUnique({ where: { orgId } });
  if (!config || !config.enabled) {
    throw new ClaimError('pool_disabled', 'Data Pool chưa được bật cho tổ chức này');
  }

  const quota = await getTodayQuotaStatus(orgId, userId);
  if (quota.remaining <= 0) {
    throw new ClaimError('quota_exceeded', `Đã đạt giới hạn ${quota.max} lead/ngày`);
  }

  const excludedStatuses = Array.isArray(config.excludedStatuses)
    ? (config.excludedStatuses as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  const requirePhone = config.requirePhoneInPool;

  const result = await prisma.$transaction(async (tx) => {
    const excludedNamesRows = excludedStatuses.length > 0
      ? await tx.status.findMany({ where: { orgId, name: { in: excludedStatuses } }, select: { id: true } })
      : [];
    const excludedStatusIds = excludedNamesRows.map((s) => s.id);

    const candidateRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM contacts
       WHERE org_id = $1
         AND assigned_user_id IS NULL
         AND merged_into IS NULL
         ${requirePhone ? 'AND phone IS NOT NULL' : ''}
         ${excludedStatusIds.length > 0 ? `AND (status_id IS NULL OR status_id NOT IN (${excludedStatusIds.map((_, i) => `$${i + 2}`).join(',')}))` : ''}
       ORDER BY pooled_count ASC, last_pooled_at ASC NULLS FIRST, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      orgId,
      ...excludedStatusIds,
    );

    const candidate = candidateRows[0];
    if (!candidate) {
      throw new ClaimError('pool_empty', 'Hiện không còn lead nào trong pool');
    }

    const updated = await tx.contact.update({
      where: { id: candidate.id },
      data: {
        assignedUserId: userId,
        pooledCount: { increment: 1 },
        lastPooledAt: new Date(),
      },
      select: { id: true, fullName: true, phone: true, source: true, pooledCount: true },
    });

    await tx.leadPoolDistribution.create({
      data: {
        orgId,
        contactId: updated.id,
        phoneNormalized: updated.phone,
        assignedToUserId: userId,
        source: 'new_inbound',
        round: updated.pooledCount,
      },
    });

    await tx.activityLog.create({
      data: {
        orgId,
        userId,
        action: 'lead_pool_claimed',
        entityType: 'contact',
        entityId: updated.id,
        details: { source: 'new_inbound', round: updated.pooledCount },
      },
    });

    return updated;
  });

  logger.info(`[lead-pool-claim] user=${userId} claimed contact=${result.id}`);
  return { contactId: result.id, fullName: result.fullName, phone: result.phone, source: result.source };
}
