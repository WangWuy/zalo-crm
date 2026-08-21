// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nguyễn Tiến Lộc
/**
 * quick-note-tag-routes.ts — Quick Note Tag CRUD (Phase 3 TheLab — chip 1-chạm).
 *
 * Mount prefix: /api/v1/quick-note-tags
 *
 * GET    /                admin+sale đọc (chọn chip khi ghi chú)
 * POST   /                tạo mới (admin)
 * PATCH  /:id             sửa label/order/isActive (admin)
 * DELETE /:id             archive — soft delete qua isActive=false (admin)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireGrant } from '../rbac/rbac-middleware.js';

export async function registerQuickNoteTagRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user!;
    const tags = await prisma.quickNoteTag.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return reply.send({ tags });
  });

  app.post(
    '/',
    { preHandler: requireGrant('settings', 'edit') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user!;
      const body = (req.body ?? {}) as { label?: string; order?: number };
      const label = (body.label || '').trim();
      if (!label) return reply.code(400).send({ error: 'MISSING_LABEL' });

      const tag = await prisma.quickNoteTag.create({
        data: { orgId: user.orgId, label, order: body.order ?? 0 },
      });
      return reply.send({ tag });
    },
  );

  app.patch(
    '/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user!;
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { label?: string; order?: number; isActive?: boolean };
      const tag = await prisma.quickNoteTag.findUnique({ where: { id } });
      if (!tag || tag.orgId !== user.orgId) return reply.code(404).send({ error: 'TAG_NOT_FOUND' });

      const updated = await prisma.quickNoteTag.update({
        where: { id: tag.id },
        data: {
          ...(body.label !== undefined ? { label: body.label.trim() } : {}),
          ...(body.order !== undefined ? { order: body.order } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      return reply.send({ tag: updated });
    },
  );

  app.delete(
    '/:id',
    { preHandler: requireGrant('settings', 'edit') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user!;
      const { id } = req.params as { id: string };
      const tag = await prisma.quickNoteTag.findUnique({ where: { id } });
      if (!tag || tag.orgId !== user.orgId) return reply.code(404).send({ error: 'TAG_NOT_FOUND' });
      await prisma.quickNoteTag.update({ where: { id: tag.id }, data: { isActive: false } });
      return reply.send({ ok: true });
    },
  );
}
