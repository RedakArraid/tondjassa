const crypto = require('node:crypto');
const db = require('../db');

const ticketInclude = {
  seller: { select: { id: true, storeName: true, slug: true, userId: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
};

const ticketDetailInclude = {
  ...ticketInclude,
  messages: {
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  },
};

function createReference(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `SUP-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

function formatMessage(message) {
  return {
    id: message.id,
    sender: message.sender,
    authorName: message.authorName || message.author?.name || null,
    author: publicUser(message.author),
    message: message.message,
    internal: Boolean(message.internal),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

function formatTicket(ticket, { includeMessages = false } = {}) {
  const formatted = {
    id: ticket.id,
    reference: ticket.reference,
    source: ticket.source,
    category: ticket.category,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    requesterName: ticket.requesterName,
    requesterEmail: ticket.requesterEmail,
    requesterPhone: ticket.requesterPhone,
    seller: ticket.seller ? {
      id: ticket.seller.id,
      storeName: ticket.seller.storeName,
      slug: ticket.seller.slug,
    } : null,
    assignedToId: ticket.assignedToId || ticket.assignedTo?.id || null,
    assignedTo: publicUser(ticket.assignedTo),
    messageCount: ticket._count?.messages ?? ticket.messages?.length ?? 0,
    lastMessageAt: ticket.lastMessageAt,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
  if (includeMessages) formatted.messages = (ticket.messages || []).map(formatMessage);
  return formatted;
}

function formatSellerTicket(ticket) {
  const visible = (ticket.messages || []).filter((message) => !message.internal);
  const firstRequest = visible.find((message) => message.sender === 'REQUESTER');
  const responses = visible.filter((message) => message.sender !== 'REQUESTER').map((message) => ({
    id: message.id,
    message: message.message,
    author: message.authorName || message.author?.name || 'Support MandeMarket',
    createdAt: message.createdAt,
  }));
  return {
    id: ticket.id,
    reference: ticket.reference,
    category: ticket.category,
    subject: ticket.subject,
    message: firstRequest?.message || '',
    status: ticket.status,
    priority: ticket.priority,
    responses,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

async function createTicket(input) {
  const now = new Date();
  const reference = createReference(now);
  return db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        reference,
        source: input.source,
        category: input.category || 'Autre',
        subject: input.subject,
        priority: input.priority || 'NORMAL',
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail.trim().toLowerCase(),
        requesterPhone: input.requesterPhone || null,
        sellerId: input.sellerId || null,
        createdById: input.createdById || null,
        lastMessageAt: now,
        messages: {
          create: {
            authorId: input.createdById || null,
            sender: 'REQUESTER',
            authorName: input.requesterName,
            message: input.message,
          },
        },
      },
      include: ticketDetailInclude,
    });
    await tx.auditLog.create({
      data: {
        userId: input.createdById || null,
        action: 'SUPPORT_TICKET_CREATED',
        entity: 'SupportTicket',
        entityId: ticket.id,
        details: { reference, source: input.source, category: ticket.category, priority: ticket.priority },
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });
    return ticket;
  });
}

module.exports = {
  ticketInclude,
  ticketDetailInclude,
  createReference,
  createTicket,
  formatMessage,
  formatTicket,
  formatSellerTicket,
};
