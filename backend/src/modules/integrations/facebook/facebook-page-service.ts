// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * facebook-page-service.ts — CRUD FacebookPageAccount (2026-08-21).
 *
 * Admin nhập Page ID + Page Access Token thủ công (lấy qua Meta Business Suite /
 * Graph API Explorer — không code OAuth flow ở bản đầu). Token mã hoá AES-256-GCM
 * qua token-encryption.util.ts, KHÔNG bao giờ trả plaintext/encrypted blob qua list API.
 */
import { prisma } from '../../../shared/database/prisma-client.js';
import { encryptToken, decryptToken, generateWebhookVerifyToken } from '../_shared/token-encryption.util.js';

export interface FacebookPageSummary {
  pageId: string;
  pageName: string | null;
  isActive: boolean;
  webhookVerifyToken: string;
  connectedByUserId: string | null;
  subscribedAt: Date;
  lastWebhookAt: Date | null;
}

function toSummary(row: {
  pageId: string; pageName: string | null; isActive: boolean; webhookVerifyToken: string;
  connectedByUserId: string | null; subscribedAt: Date; lastWebhookAt: Date | null;
}): FacebookPageSummary {
  return {
    pageId: row.pageId,
    pageName: row.pageName,
    isActive: row.isActive,
    webhookVerifyToken: row.webhookVerifyToken,
    connectedByUserId: row.connectedByUserId,
    subscribedAt: row.subscribedAt,
    lastWebhookAt: row.lastWebhookAt,
  };
}

export async function listPages(orgId: string): Promise<FacebookPageSummary[]> {
  const rows = await prisma.facebookPageAccount.findMany({
    where: { orgId },
    orderBy: { subscribedAt: 'desc' },
    select: {
      pageId: true, pageName: true, isActive: true, webhookVerifyToken: true,
      connectedByUserId: true, subscribedAt: true, lastWebhookAt: true,
    },
  });
  return rows.map(toSummary);
}

export async function connectPage(input: {
  orgId: string;
  userId: string;
  pageId: string;
  pageName?: string;
  pageAccessToken: string;
}): Promise<FacebookPageSummary> {
  const row = await prisma.facebookPageAccount.upsert({
    where: { pageId: input.pageId },
    create: {
      orgId: input.orgId,
      pageId: input.pageId,
      pageName: input.pageName ?? null,
      encryptedAccessToken: encryptToken(input.pageAccessToken),
      webhookVerifyToken: generateWebhookVerifyToken(),
      connectedByUserId: input.userId,
    },
    update: {
      pageName: input.pageName ?? undefined,
      encryptedAccessToken: encryptToken(input.pageAccessToken),
      isActive: true,
      connectedByUserId: input.userId,
    },
    select: {
      pageId: true, pageName: true, isActive: true, webhookVerifyToken: true,
      connectedByUserId: true, subscribedAt: true, lastWebhookAt: true,
    },
  });
  return toSummary(row);
}

export async function togglePage(orgId: string, pageId: string, isActive: boolean): Promise<void> {
  await prisma.facebookPageAccount.updateMany({ where: { orgId, pageId }, data: { isActive } });
}

export async function disconnectPage(orgId: string, pageId: string): Promise<void> {
  await prisma.facebookPageAccount.deleteMany({ where: { orgId, pageId } });
}

/** Trả page account theo pageId (bất kỳ org nào — webhook không biết trước org). */
export async function findActivePageByPageId(pageId: string) {
  return prisma.facebookPageAccount.findFirst({ where: { pageId, isActive: true } });
}

export function getDecryptedToken(encryptedAccessToken: string): string {
  return decryptToken(encryptedAccessToken);
}

export async function touchLastWebhookAt(pageId: string): Promise<void> {
  await prisma.facebookPageAccount.updateMany({ where: { pageId }, data: { lastWebhookAt: new Date() } });
}
