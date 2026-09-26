const express = require('express');
const { z } = require('zod');
const db = require('./db');
const { requireAuth, requireRole } = require('./middleware.auth');
const supportTickets = require('./services/support-ticket.service');

const router = express.Router();
router.use(requireAuth, requireRole(['support', 'admin']));

const statuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const activeStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER'];

const listSchema = z.object({
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  assigneeId: z.string().trim().max(100).optional(),
  assignedTo: z.string().trim().max(100).optional(),
}).strict();

const replySchema = z.object({
  message: z.string().trim().min(2).max(5000),
  internal: z.boolean().optional().default(false),
}).strict();

const updateSchema = z.object({
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  assigneeId: z.string().trim().min(1).max(100).nullable().optional(),
  assignedToId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Au moins une modification est requise');

function validationError(res, error) {
  if (error?.name !== 'ZodError') return false;
  res.status(400).json({ error: 'Données support invalides', details: error.errors });
  return true;
}

// GET /api/support/stats - KPI opérationnels persistants.
router.get('/stats', async (_req, res) => {
  try {
    const [byStatus, urgent, unassigned] = await Promise.all([
      db.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
      db.supportTicket.count({ where: { priority: 'URGENT', status: { in: activeStatuses } } }),
      db.supportTicket.count({ where: { assignedToId: null, status: { in: activeStatuses } } }),
    ]);
    const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
    res.json({
      stats: {
        total: Object.values(counts).reduce((sum, value) => sum + value, 0),
        open: counts.OPEN || 0,
        inProgress: counts.IN_PROGRESS || 0,
        waitingCustomer: counts.WAITING_CUSTOMER || 0,
        resolved: counts.RESOLVED || 0,
        closed: counts.CLOSED || 0,
        urgent,
        unassigned,
      },
    });
  } catch (error) {
    console.error('Erreur statistiques support:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques support' });
  }
});

// GET /api/support/tickets - Recherche, filtres et pagination.
router.get('/tickets', async (req, res) => {
  try {
    const input = listSchema.parse(req.query);
    const where = {};
    if (input.status) where.status = input.status;
    if (input.priority) where.priority = input.priority;
    const assignmentFilter = input.assignedTo || input.assigneeId;
    if (assignmentFilter === 'me') where.assignedToId = req.user.userId;
    else if (assignmentFilter === 'unassigned') where.assignedToId = null;
    else if (assignmentFilter) where.assignedToId = assignmentFilter;
    if (input.search) {
      where.OR = [
        { reference: { contains: input.search, mode: 'insensitive' } },
        { subject: { contains: input.search, mode: 'insensitive' } },
        { requesterName: { contains: input.search, mode: 'insensitive' } },
        { requesterEmail: { contains: input.search, mode: 'insensitive' } },
        { seller: { storeName: { contains: input.search, mode: 'insensitive' } } },
      ];
    }
    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        include: { ...supportTickets.ticketInclude, _count: { select: { messages: true } } },
        orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      db.supportTicket.count({ where }),
    ]);
    res.json({
      tickets: tickets.map((ticket) => supportTickets.formatTicket(ticket)),
      pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) },
    });
  } catch (error) {
    if (validationError(res, error)) return;
    console.error('Erreur liste support:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des tickets' });
  }
});

// GET /api/support/tickets/:id - Conversation complète, notes internes incluses.
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: req.params.id },
      include: supportTickets.ticketDetailInclude,
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });
    res.json({ ticket: supportTickets.formatTicket(ticket, { includeMessages: true }) });
  } catch (error) {
    console.error('Erreur détail support:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du ticket' });
  }
});

// POST /api/support/tickets/:id/replies - Réponse durable de l'équipe support.
// `/messages` reste un alias explicite pour les premiers clients du portail.
async function replyToTicket(req, res) {
  try {
    const input = replySchema.parse(req.body);
    const existing = await db.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { seller: { select: { userId: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket introuvable' });
    if (existing.status === 'CLOSED') return res.status(409).json({ error: 'Un ticket clôturé ne peut plus recevoir de réponse' });

    const result = await db.$transaction(async (tx) => {
      const reply = await tx.supportMessage.create({
        data: {
          ticketId: existing.id,
          authorId: req.user.userId,
          sender: 'STAFF',
          authorName: req.user.email,
          message: input.message,
          internal: input.internal,
        },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      });
      const ticket = await tx.supportTicket.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: reply.createdAt,
          status: input.internal ? existing.status : 'WAITING_CUSTOMER',
        },
        include: supportTickets.ticketDetailInclude,
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: input.internal ? 'SUPPORT_TICKET_INTERNAL_NOTE' : 'SUPPORT_TICKET_REPLIED',
          entity: 'SupportTicket',
          entityId: existing.id,
          details: {
            reference: existing.reference,
            internal: input.internal,
            previousStatus: existing.status,
            status: input.internal ? existing.status : 'WAITING_CUSTOMER',
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
        },
      });
      if (!input.internal && existing.seller?.userId) {
        await tx.notification.create({
          data: {
            userId: existing.seller.userId,
            type: 'SYSTEM',
            title: `Réponse du support · ${existing.reference}`,
            message: input.message.slice(0, 240),
            metadata: { ticketId: existing.id, reference: existing.reference, href: '/vendeur/dashboard/communication/support' },
          },
        });
      }
      return { reply, ticket };
    });
    if (!input.internal) {
      try {
        await require('./services/email.service').sendSupportReply({
          to: existing.requesterEmail,
          requesterName: existing.requesterName,
          reference: existing.reference,
          subject: existing.subject,
          message: input.message,
          replyId: result.reply.id,
        });
      } catch (emailError) {
        console.warn(`[Support] Réponse ${result.reply.id} persistée; notification email indisponible:`, emailError.message);
      }
    }
    res.status(201).json({
      reply: supportTickets.formatMessage(result.reply),
      ticket: supportTickets.formatTicket(result.ticket, { includeMessages: true }),
    });
  } catch (error) {
    if (validationError(res, error)) return;
    console.error('Erreur réponse support:', error);
    res.status(500).json({ error: 'Erreur lors de l’envoi de la réponse' });
  }
}
router.post('/tickets/:id/replies', replyToTicket);
router.post('/tickets/:id/messages', replyToTicket);

// PATCH /api/support/tickets/:id - Statut, priorité et assignation.
router.patch('/tickets/:id', async (req, res) => {
  try {
    const input = updateSchema.parse(req.body);
    const existing = await db.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { seller: { select: { userId: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket introuvable' });

    const assigneeId = input.assignedToId !== undefined ? input.assignedToId : input.assigneeId;
    if (assigneeId) {
      const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { role: true, emailVerifiedAt: true } });
      if (!assignee || !['support', 'admin'].includes(assignee.role) || !assignee.emailVerifiedAt) {
        return res.status(400).json({ error: 'Le responsable doit être un compte support ou administrateur actif' });
      }
    }

    const now = new Date();
    const data = {
      ...(input.status && { status: input.status }),
      ...(input.priority && { priority: input.priority }),
      ...(assigneeId !== undefined && { assignedToId: assigneeId }),
    };
    if (input.status) {
      data.resolvedAt = ['RESOLVED', 'CLOSED'].includes(input.status) ? (existing.resolvedAt || now) : null;
      data.closedAt = input.status === 'CLOSED' ? now : null;
    }
    const ticket = await db.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id: existing.id },
        data,
        include: supportTickets.ticketDetailInclude,
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'SUPPORT_TICKET_UPDATED',
          entity: 'SupportTicket',
          entityId: existing.id,
          details: { previous: { status: existing.status, priority: existing.priority, assigneeId: existing.assignedToId }, changes: input },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
        },
      });
      if (input.status && input.status !== existing.status && existing.seller?.userId) {
        await tx.notification.create({
          data: {
            userId: existing.seller.userId,
            type: 'SYSTEM',
            title: `Ticket ${existing.reference} · ${input.status}`,
            message: `Le statut de votre demande « ${existing.subject} » a été mis à jour.`,
            metadata: { ticketId: existing.id, reference: existing.reference, href: '/vendeur/dashboard/communication/support' },
          },
        });
      }
      return updated;
    });
    res.json({ ticket: supportTickets.formatTicket(ticket, { includeMessages: true }) });
  } catch (error) {
    if (validationError(res, error)) return;
    console.error('Erreur mise à jour support:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du ticket' });
  }
});

module.exports = router;
