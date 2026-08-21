// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * claim-quota-routes.ts — Phase 2 Data Pool tự phục vụ 2026-08-21.
 *
 * GET  /api/v1/lead-pool/quota  — quota hôm nay (badge realtime)
 * POST /api/v1/lead-pool/claim  — bốc 1 lead nguồn 'new_inbound'
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import { zaloPool } from '../zalo/zalo-pool.js';
import { logger } from '../../shared/utils/logger.js';
import { getTodayQuotaStatus, claimNextLead, ClaimError } from './claim-quota-service.js';

export async function registerLeadPoolClaimRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/lead-pool/quota
  app.get('/quota', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    const quota = await getTodayQuotaStatus(user.orgId, user.id);
    return reply.send(quota);
  });

  // POST /api/v1/lead-pool/claim
  app.post('/claim', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    try {
      const lead = await claimNextLead(user.orgId, user.id);
      const quota = await getTodayQuotaStatus(user.orgId, user.id);

      const io = zaloPool.getIO();
      if (io) {
        io.to(`org:${user.orgId}`).emit('lead_pool:claimed', {
          userId: user.id,
          claimed: quota.claimed,
          max: quota.max,
        });
      }

      return reply.send({ lead, quota });
    } catch (err) {
      if (err instanceof ClaimError) {
        const status = err.code === 'quota_exceeded' ? 409 : err.code === 'pool_empty' ? 404 : 400;
        return reply.status(status).send({ error: err.message, code: err.code });
      }
      logger.error('[lead-pool-claim] claim error:', err);
      return reply.status(500).send({ error: 'Không thể bốc lead lúc này' });
    }
  });
}
