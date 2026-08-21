// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * facebook-webhook-routes.ts — Nhận lead thật từ Facebook Lead Ads (2026-08-21).
 *
 * Route PUBLIC (không authMiddleware) — Meta gọi trực tiếp. Xác thực bằng:
 *   - GET  (verify challenge): so hub.verify_token với FacebookPageAccount.webhookVerifyToken
 *   - POST (nhận lead event): HMAC-SHA256 X-Hub-Signature-256, verify trên RAW BODY
 *     (không phải JSON đã parse lại) qua verifyHmacSignature() — bắt buộc raw Buffer,
 *     nên route này tự đăng ký content-type parser riêng (parseAs: 'buffer').
 *
 * Idempotency qua WebhookLog.externalLeadId (leadgen_id) — FB retry cùng event
 * nhiều lần khi không nhận 200 nhanh, recordIngestion() chặn xử lý trùng.
 *
 * Luôn trả 200 cho Meta sau khi đã ghi log (kể cả lỗi xử lý tiếp theo) để tránh
 * Meta coi webhook "chết" và ngừng gửi / retry storm ngoài tầm kiểm soát — lỗi xử lý
 * được ghi vào WebhookLog.errorMessage, retry qua pickPending() (cron ngoài phạm vi
 * bản đầu, xem plan "Việc KHÔNG làm").
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyHmacSignature } from '../../../shared/security/hmac.js';
import { logger } from '../../../shared/utils/logger.js';
import { recordIngestion, markProcessed, markFailedWithRetry } from '../_shared/webhook-log.service.js';
import { findActivePageByPageId, getDecryptedToken, touchLastWebhookAt } from './facebook-page-service.js';
import { fetchLeadDetail } from './facebook-graph-client.js';
import { ingestNormalizedLead } from './facebook-lead-ingest-service.js';
import { assertValidLead } from '../_shared/normalized-lead.schema.js';

interface FbWebhookChangeValue {
  leadgen_id: string;
  page_id: string;
  form_id?: string;
  created_time?: number;
}
interface FbWebhookEntry {
  id: string; // page_id
  time: number;
  changes: Array<{ field: string; value: FbWebhookChangeValue }>;
}
interface FbWebhookPayload {
  object: string;
  entry: FbWebhookEntry[];
}

export async function facebookWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Raw body capture — chỉ trong scope route này (không ảnh hưởng content-type
  // parser toàn cục của app chính, đăng ký qua encapsulated child instance).
  await app.register(async (sub) => {
    sub.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      try {
        const buf = body as Buffer;
        const json = buf.length > 0 ? JSON.parse(buf.toString('utf8')) : {};
        (json as Record<string, unknown>).__rawBody = buf;
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    });

    // GET /api/v1/webhooks/facebook — hub.challenge verification
    sub.get('/api/v1/webhooks/facebook', async (request: FastifyRequest, reply: FastifyReply) => {
      const q = request.query as Record<string, string | undefined>;
      const mode = q['hub.mode'];
      const token = q['hub.verify_token'];
      const challenge = q['hub.challenge'];
      if (mode !== 'subscribe' || !token || !challenge) {
        return reply.status(400).send('Bad request');
      }
      const appVerifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || process.env.FB_WEBHOOK_VERIFY_TOKEN;
      const validAppLevel = appVerifyToken && token === appVerifyToken;
      // Fallback: nếu App không set 1 token chung, thử khớp theo từng Page đã kết nối.
      const validPerPage = !validAppLevel ? await verifyTokenAgainstAnyPage(token) : false;
      if (!validAppLevel && !validPerPage) {
        logger.warn('[fb-webhook] Verify challenge failed — token mismatch');
        return reply.status(403).send('Forbidden');
      }
      return reply.status(200).send(challenge);
    });

    // POST /api/v1/webhooks/facebook — nhận lead event
    sub.post('/api/v1/webhooks/facebook', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as FbWebhookPayload & { __rawBody?: Buffer };
      const rawBody = body.__rawBody ?? Buffer.from(JSON.stringify(body));
      const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;
      const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.FB_APP_SECRET;

      if (!appSecret) {
        logger.error('[fb-webhook] FACEBOOK_APP_SECRET missing — cannot verify signature, rejecting');
        return reply.status(500).send({ error: 'server_misconfigured' });
      }
      const providedHex = signatureHeader?.replace(/^sha256=/, '');
      if (!verifyHmacSignature(rawBody, providedHex, appSecret)) {
        logger.warn('[fb-webhook] Invalid X-Hub-Signature-256 — rejected');
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      if (body.object !== 'page' || !Array.isArray(body.entry)) {
        return reply.status(200).send({ ok: true }); // không phải leadgen event, ack im lặng
      }

      for (const entry of body.entry) {
        for (const change of entry.changes ?? []) {
          if (change.field !== 'leadgen') continue;
          await processLeadgenEvent(change.value, signatureHeader);
        }
      }

      return reply.status(200).send({ ok: true });
    });
  });
}

async function verifyTokenAgainstAnyPage(token: string): Promise<boolean> {
  // Bản đầu: 1 App Facebook thường subscribe chung cho nhiều Page cùng org.
  // Nếu không set FACEBOOK_WEBHOOK_VERIFY_TOKEN ở env, chấp nhận token khớp
  // BẤT KỲ page nào đã kết nối (best-effort — admin nên ưu tiên set env token chung).
  const { prisma } = await import('../../../shared/database/prisma-client.js');
  const match = await prisma.facebookPageAccount.findFirst({ where: { webhookVerifyToken: token } });
  return !!match;
}

async function processLeadgenEvent(value: FbWebhookChangeValue, signature: string | undefined): Promise<void> {
  const { logId, isFirst } = await recordIngestion({
    source: 'fb-leadads',
    externalLeadId: value.leadgen_id,
    rawBody: value as unknown,
    signature,
    orgId: null,
  });

  if (!isFirst) {
    logger.info(`[fb-webhook] Duplicate leadgen_id=${value.leadgen_id} — skip`);
    return;
  }

  try {
    const page = await findActivePageByPageId(value.page_id);
    if (!page) {
      throw new Error(`No active FacebookPageAccount for page_id=${value.page_id}`);
    }
    const token = getDecryptedToken(page.encryptedAccessToken);
    const lead = await fetchLeadDetail(value.leadgen_id, token);
    lead.sourceMeta.pageId = value.page_id;
    assertValidLead(lead);

    const result = await ingestNormalizedLead(page.orgId, lead);
    await touchLastWebhookAt(value.page_id);

    if (result.entryId) {
      await markProcessed(logId, result.entryId);
      logger.info(`[fb-webhook] Ingested lead ${value.leadgen_id} → entry ${result.entryId} (list ${result.listId})`);
    } else {
      await markFailedWithRetry(logId, `skipped: ${result.skippedReason}`, 0);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[fb-webhook] Processing failed for leadgen_id=${value.leadgen_id}: ${message}`);
    await markFailedWithRetry(logId, message, 0);
  }
}
