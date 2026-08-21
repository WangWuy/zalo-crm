// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * facebook-lead-ingest-service.ts — NormalizedLead → CustomerListEntry (2026-08-21).
 *
 * Dùng lại parseMappedRows() (validate/normalize phone giống hệt luồng CSV/Excel
 * import) + resolveListFromCampaign() (#KEY routing) + kickoffEnrichment() (worker
 * Zalo UID lookup có sẵn) — KHÔNG tự chế lại logic đã có trong list-import-service.ts.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../../../shared/database/prisma-client.js';
import { logger } from '../../../shared/utils/logger.js';
import { parseMappedRows } from '../../lists/list-import-service.js';
import { kickoffEnrichment } from '../../lists/list-enrichment-service.js';
import { recomputeListCounters } from '../../lists/list-entry-routes.js';
import { buildMessagesFromState, type SystemMessage } from '../../lists/list-system-messages.js';
import { resolveListFromCampaign } from '../_shared/lead-routing.service.js';
import type { NormalizedLead } from '../_shared/normalized-lead.schema.js';

export interface IngestResult {
  entryId: string | null;
  listId: string;
  skippedReason?: 'invalid_phone' | 'duplicate_in_list';
}

/** Insert 1 NormalizedLead vào CustomerList đúng (theo #KEY routing), trả entryId. */
export async function ingestNormalizedLead(orgId: string, lead: NormalizedLead): Promise<IngestResult> {
  const routing = await resolveListFromCampaign(
    orgId,
    lead.sourceMeta.campaignId ?? lead.sourceMeta.externalLeadId,
    lead.campaignName,
    lead.source,
  );

  const [parsed] = parseMappedRows([{ phone: lead.phone, name: lead.name || null }]);
  if (!parsed || !parsed.valid) {
    logger.warn(`[fb-ingest] Invalid phone for lead ${lead.sourceMeta.externalLeadId}: "${lead.phone}"`);
    return { entryId: null, listId: routing.listId, skippedReason: 'invalid_phone' };
  }

  // Dedupe trong cùng list theo phoneE164 — 1 lead FB không nên tạo 2 entry trùng
  // (submit lại form / webhook FB gửi lặp không qua idempotency externalLeadId, ví dụ
  // KH tự điền form 2 lần với cùng SĐT).
  const existing = parsed.phoneE164
    ? await prisma.customerListEntry.findFirst({
        where: { customerListId: routing.listId, phoneE164: parsed.phoneE164 },
        select: { id: true },
      })
    : null;
  if (existing) {
    return { entryId: existing.id, listId: routing.listId, skippedReason: 'duplicate_in_list' };
  }

  const rowCount = await prisma.customerListEntry.count({ where: { customerListId: routing.listId } });
  const msgs: SystemMessage[] = buildMessagesFromState({
    invalidReason: null,
    dupInListWithEntryId: null,
    dupWithListId: null,
    dupWithListEntryId: null,
    dupWithListName: null,
    dupWithContactId: null,
  }).map((m) => ({ ...m, ts: new Date().toISOString() }));

  const entry = await prisma.customerListEntry.create({
    data: {
      id: randomUUID(),
      customerListId: routing.listId,
      rowIndex: rowCount + 1,
      phoneRaw: lead.phone.slice(0, 500),
      nameRaw: lead.name || null,
      phoneE164: parsed.phoneE164,
      phoneLocal: parsed.phoneLocal,
      phoneValid: true,
      status: 'validated',
      systemMessages: msgs as unknown as object,
      customFields: lead.customFields as object,
      sourceMeta: lead.sourceMeta as unknown as object,
      fbLeadgenId: lead.sourceMeta.externalLeadId,
      fbAdId: lead.sourceMeta.adId ?? null,
      fbAdsetId: lead.sourceMeta.adSetId ?? null,
      fbCampaignId: lead.sourceMeta.campaignId ?? null,
      fbCampaignName: lead.campaignName || null,
      fbFormId: lead.sourceMeta.formId ?? null,
    },
    select: { id: true },
  });

  await recomputeListCounters(routing.listId);
  void kickoffEnrichment(routing.listId);

  return { entryId: entry.id, listId: routing.listId };
}
