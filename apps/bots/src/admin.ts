import { prisma } from '@float/db';
import Fastify, { type FastifyInstance } from 'fastify';
import { botConfig } from './config.js';
import { getQueue } from './queues.js';

/**
 * Admin HTTP API (bearer-token auth): trigger a cycle, approve an airdrop
 * round, pause/unpause a quote mint, and inspect the tx log.
 */
export function buildAdmin(): FastifyInstance {
  const cfg = botConfig();
  const app = Fastify({ logger: true });

  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/health') return;
    const token = cfg.ADMIN_API_TOKEN;
    if (!token) {
      req.log.warn('ADMIN_API_TOKEN not set — admin API is unauthenticated');
      return;
    }
    const auth = req.headers.authorization ?? '';
    const presented = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (presented !== token) return reply.code(401).send({ error: 'unauthorized' });
  });

  app.get('/health', async () => ({ ok: true }));

  // Trigger a cycle for one coin (permissionless-rate-limited at the edge).
  app.post<{ Params: { pool: string } }>('/cycle/:pool', async (req) => {
    await getQueue().add('cycle', { onlyPool: req.params.pool });
    return { queued: true, pool: req.params.pool };
  });

  // Approve an airdrop round so airdrop:send will process it.
  app.post<{ Params: { id: string } }>('/airdrop/rounds/:id/approve', async (req, reply) => {
    const round = await prisma.airdropRound.findUnique({ where: { id: req.params.id } });
    if (!round) return reply.code(404).send({ error: 'round not found' });
    await prisma.airdropRound.update({ where: { id: req.params.id }, data: { status: 'approved' } });
    return { approved: req.params.id };
  });

  // Pause / unpause a quote mint (cycle + payout skip it).
  app.post<{ Params: { quoteMint: string } }>('/pause/:quoteMint', async (req, reply) => {
    const updated = await prisma.poolConfig.updateMany({
      where: { quoteMint: req.params.quoteMint },
      data: { paused: true },
    });
    if (updated.count === 0) return reply.code(404).send({ error: 'quote mint not found' });
    return { paused: req.params.quoteMint };
  });
  app.post<{ Params: { quoteMint: string } }>('/unpause/:quoteMint', async (req, reply) => {
    const updated = await prisma.poolConfig.updateMany({
      where: { quoteMint: req.params.quoteMint },
      data: { paused: false },
    });
    if (updated.count === 0) return reply.code(404).send({ error: 'quote mint not found' });
    return { unpaused: req.params.quoteMint };
  });

  // Inspect recent tx-log rows.
  app.get<{ Querystring: { bot?: string; limit?: string } }>('/tx-log', async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const rows = await prisma.txLog.findMany({
      where: req.query.bot ? { bot: req.query.bot } : undefined,
      orderBy: { ts: 'desc' },
      take: limit,
    });
    return rows;
  });

  return app;
}
