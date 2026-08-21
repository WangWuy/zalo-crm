// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * facebook-page-routes.ts — Admin CRUD FacebookPageAccount (2026-08-21).
 *
 * GET    /api/v1/integrations/facebook/pages          — list page đã kết nối
 * POST   /api/v1/integrations/facebook/pages           — kết nối page mới (nhập tay Page ID + Token)
 * PATCH  /api/v1/integrations/facebook/pages/:pageId   — toggle isActive
 * DELETE /api/v1/integrations/facebook/pages/:pageId
 *
 * Không bao giờ trả pageAccessToken (plaintext hay encrypted) qua các route này.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../auth/auth-middleware.js';
import { requireGrant } from '../../rbac/rbac-middleware.js';
import { logger } from '../../../shared/utils/logger.js';
import { listPages, connectPage, togglePage, disconnectPage } from './facebook-page-service.js';

export async function facebookPageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/v1/integrations/facebook/pages', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const pages = await listPages(user.orgId);
    return reply.send({ pages });
  });

  app.post('/api/v1/integrations/facebook/pages', { preHandler: requireGrant('settings', 'create') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { pageId, pageName, pageAccessToken } = request.body as { pageId: string; pageName?: string; pageAccessToken: string };
    if (!pageId?.trim() || !pageAccessToken?.trim()) {
      return reply.status(400).send({ error: 'pageId và pageAccessToken là bắt buộc' });
    }
    try {
      const page = await connectPage({ orgId: user.orgId, userId: user.id, pageId: pageId.trim(), pageName: pageName?.trim(), pageAccessToken: pageAccessToken.trim() });
      return reply.status(201).send({ page });
    } catch (err) {
      logger.error('[fb-page-routes] connectPage error:', err);
      return reply.status(500).send({ error: 'Không thể kết nối Page' });
    }
  });

  app.patch('/api/v1/integrations/facebook/pages/:pageId', { preHandler: requireGrant('settings', 'edit') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { pageId } = request.params as { pageId: string };
    const { isActive } = request.body as { isActive: boolean };
    if (typeof isActive !== 'boolean') return reply.status(400).send({ error: 'isActive required' });
    await togglePage(user.orgId, pageId, isActive);
    return reply.send({ ok: true });
  });

  app.delete('/api/v1/integrations/facebook/pages/:pageId', { preHandler: requireGrant('settings', 'edit') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { pageId } = request.params as { pageId: string };
    await disconnectPage(user.orgId, pageId);
    return reply.send({ ok: true });
  });
}
