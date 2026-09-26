const db = require('../db');
const emailService = require('../services/email.service');
const supportService = require('../services/support-ticket.service');
const { requireRole } = require('../middleware.auth');

function routeHandler(router, routePath, method) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${routePath} introuvable`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function routeMiddleware(router, routePath, method, index) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${routePath} introuvable`);
  return layer.route.stack[index].handle;
}

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

describe('Espace support persistant', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each([
    ['support', true],
    ['admin', true],
    ['manager', false],
    ['seller', false],
    ['customer', false],
  ])('autorisation support/admin: %s -> %s', (role, allowed) => {
    const middleware = requireRole(['support', 'admin']);
    const res = responseRecorder();
    const next = jest.fn();
    middleware({ user: { role } }, res, next);
    if (allowed) expect(next).toHaveBeenCalledTimes(1);
    else {
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    }
  });

  test('les routes canoniques et leurs alias rétrocompatibles restent exposés', () => {
    const supportRouter = require('../routes.support');
    const sellerRouter = require('../routes.sellers');
    expect(routeHandler(supportRouter, '/tickets/:id/replies', 'post')).toBe(
      routeHandler(supportRouter, '/tickets/:id/messages', 'post'),
    );
    expect(routeHandler(sellerRouter, '/me/notifications/:id/read', 'patch')).toBe(
      routeHandler(sellerRouter, '/me/notifications/:id/read', 'put'),
    );
    expect(routeHandler(sellerRouter, '/me/notifications/read-all', 'patch')).toBe(
      routeHandler(sellerRouter, '/me/notifications/read-all', 'post'),
    );
  });

  test('les KPI support sont calculés depuis les tickets persistants', async () => {
    const router = require('../routes.support');
    const handler = routeHandler(router, '/stats', 'get');
    jest.spyOn(db.supportTicket, 'groupBy').mockResolvedValue([
      { status: 'OPEN', _count: { _all: 3 } },
      { status: 'RESOLVED', _count: { _all: 2 } },
    ]);
    jest.spyOn(db.supportTicket, 'count').mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const res = responseRecorder();
    await handler({}, res);
    expect(res.payload).toEqual({ stats: expect.objectContaining({
      total: 5, open: 3, resolved: 2, urgent: 1, unassigned: 2,
    }) });
  });

  test('la liste accepte le filtre assignedTo utilisé par le portail', async () => {
    const router = require('../routes.support');
    const handler = routeHandler(router, '/tickets', 'get');
    const findMany = jest.spyOn(db.supportTicket, 'findMany').mockResolvedValue([]);
    jest.spyOn(db.supportTicket, 'count').mockResolvedValue(0);
    const res = responseRecorder();
    await handler({ query: { assignedTo: 'me' }, user: { userId: 'support-user' } }, res);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { assignedToId: 'support-user' } }));
    expect(res.payload.pagination).toEqual({ page: 1, limit: 20, total: 0, pages: 0 });
  });

  test('un ticket est créé avec son premier message et une trace audit', async () => {
    const created = {
      id: 'ticket-1', reference: 'SUP-20260926-ABC123', source: 'SELLER', category: 'Paiement',
      subject: 'Retrait bloqué', status: 'OPEN', priority: 'NORMAL', requesterName: 'Aminata',
      requesterEmail: 'seller@example.com', messages: [], createdAt: new Date(), updatedAt: new Date(),
    };
    const supportTicketCreate = jest.fn().mockResolvedValue(created);
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    jest.spyOn(db, '$transaction').mockImplementation((callback) => callback({
      supportTicket: { create: supportTicketCreate },
      auditLog: { create: auditCreate },
    }));

    const result = await supportService.createTicket({
      source: 'SELLER', category: 'Paiement', subject: 'Retrait bloqué',
      message: 'Mon retrait reste bloqué depuis hier.', requesterName: 'Aminata',
      requesterEmail: 'SELLER@EXAMPLE.COM', sellerId: 'seller-1', createdById: 'user-1',
    });

    expect(result).toBe(created);
    expect(supportTicketCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      source: 'SELLER', sellerId: 'seller-1', createdById: 'user-1', requesterEmail: 'seller@example.com',
      messages: { create: expect.objectContaining({ sender: 'REQUESTER', message: 'Mon retrait reste bloqué depuis hier.' }) },
    }) }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'SUPPORT_TICKET_CREATED', entityId: 'ticket-1',
    }) }));
  });

  test('la liste vendeur est strictement isolée sur la boutique courante', async () => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, '/me/support/tickets', 'get');
    const findMany = jest.spyOn(db.supportTicket, 'findMany').mockResolvedValue([]);
    const res = responseRecorder();
    await handler({ seller: { id: 'seller-current' } }, res);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { sellerId: 'seller-current' } }));
    expect(res.payload).toEqual([]);
  });

  test('la lecture notification ne peut pas cibler celle d’un autre vendeur', async () => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, '/me/notifications/:id/read', 'patch');
    const updateMany = jest.spyOn(db.notification, 'updateMany').mockResolvedValue({ count: 0 });
    const res = responseRecorder();
    await handler({ params: { id: 'notification-other' }, user: { userId: 'seller-user' } }, res);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'notification-other', userId: 'seller-user' },
    }));
    expect(res.statusCode).toBe(404);
  });

  test('GET notifications expose la collection et le compteur non lu', async () => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, '/me/notifications', 'get');
    jest.spyOn(db.notification, 'findMany').mockResolvedValue([{ id: 'notification-1', isRead: false }]);
    jest.spyOn(db.notification, 'count').mockResolvedValue(1);
    const res = responseRecorder();
    await handler({ user: { userId: 'seller-user' } }, res);
    expect(res.payload).toEqual({ notifications: [{ id: 'notification-1', isRead: false }], unreadCount: 1 });
  });

  test('une réponse support persiste le message, change le statut et notifie le vendeur', async () => {
    const router = require('../routes.support');
    const handler = routeHandler(router, '/tickets/:id/replies', 'post');
    const createdAt = new Date();
    jest.spyOn(db.supportTicket, 'findUnique').mockResolvedValue({
      id: 'ticket-1', reference: 'SUP-1', subject: 'Aide', requesterName: 'Aminata',
      requesterEmail: 'amina@example.com', status: 'OPEN', seller: { userId: 'seller-user' },
    });
    jest.spyOn(emailService, 'sendSupportReply').mockResolvedValue({ success: true, queued: true });
    const messageCreate = jest.fn().mockResolvedValue({
      id: 'reply-1', sender: 'STAFF', message: 'Votre demande est traitée.', internal: false, createdAt, updatedAt: createdAt,
    });
    const ticketUpdate = jest.fn().mockResolvedValue({
      id: 'ticket-1', reference: 'SUP-1', source: 'SELLER', category: 'Autre', subject: 'Aide',
      status: 'WAITING_CUSTOMER', priority: 'NORMAL', requesterName: 'Aminata', requesterEmail: 'a@example.com',
      messages: [], lastMessageAt: createdAt, createdAt, updatedAt: createdAt,
    });
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'notification-1' });
    jest.spyOn(db, '$transaction').mockImplementation((callback) => callback({
      supportMessage: { create: messageCreate }, supportTicket: { update: ticketUpdate },
      auditLog: { create: jest.fn().mockResolvedValue({}) }, notification: { create: notificationCreate },
    }));
    const res = responseRecorder();
    await handler({
      params: { id: 'ticket-1' }, body: { message: 'Votre demande est traitée.' },
      user: { userId: 'support-user', email: 'support@example.com' }, headers: {}, ip: '127.0.0.1',
    }, res);
    expect(res.statusCode).toBe(201);
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sender: 'STAFF' }) }));
    expect(ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING_CUSTOMER' }) }));
    expect(notificationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'seller-user' }) }));
  });

  test('une note interne reste invisible au vendeur et ne déclenche aucune notification', async () => {
    const router = require('../routes.support');
    const handler = routeHandler(router, '/tickets/:id/messages', 'post');
    const createdAt = new Date();
    jest.spyOn(db.supportTicket, 'findUnique').mockResolvedValue({
      id: 'ticket-1', reference: 'SUP-1', subject: 'Aide', requesterName: 'Aminata',
      requesterEmail: 'amina@example.com', status: 'IN_PROGRESS', seller: { userId: 'seller-user' },
    });
    const messageCreate = jest.fn().mockResolvedValue({
      id: 'note-1', sender: 'STAFF', message: 'Vérifier le compte.', internal: true, createdAt, updatedAt: createdAt,
    });
    const ticketUpdate = jest.fn().mockResolvedValue({
      id: 'ticket-1', reference: 'SUP-1', source: 'SELLER', category: 'Autre', subject: 'Aide',
      status: 'IN_PROGRESS', priority: 'NORMAL', requesterName: 'Aminata', requesterEmail: 'a@example.com',
      messages: [], lastMessageAt: createdAt, createdAt, updatedAt: createdAt,
    });
    const notificationCreate = jest.fn();
    jest.spyOn(db, '$transaction').mockImplementation((callback) => callback({
      supportMessage: { create: messageCreate }, supportTicket: { update: ticketUpdate },
      auditLog: { create: jest.fn().mockResolvedValue({}) }, notification: { create: notificationCreate },
    }));
    const email = jest.spyOn(emailService, 'sendSupportReply');
    const res = responseRecorder();
    await handler({
      params: { id: 'ticket-1' }, body: { message: 'Vérifier le compte.', internal: true },
      user: { userId: 'support-user', email: 'support@example.com' }, headers: {}, ip: '127.0.0.1',
    }, res);
    expect(res.statusCode).toBe(201);
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ internal: true }) }));
    expect(ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }));
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();

    const sellerView = supportService.formatSellerTicket({
      ...ticketUpdate.mock.results[0].value,
      messages: [{ id: 'note-1', sender: 'STAFF', message: 'Secret', internal: true, createdAt }],
    });
    expect(sellerView.responses).toEqual([]);
  });

  test('la mise à jour refuse une assignation vers un manager', async () => {
    const router = require('../routes.support');
    const handler = routeHandler(router, '/tickets/:id', 'patch');
    jest.spyOn(db.supportTicket, 'findUnique').mockResolvedValue({ id: 'ticket-1', status: 'OPEN', priority: 'NORMAL' });
    jest.spyOn(db.user, 'findUnique').mockResolvedValue({ role: 'manager', emailVerifiedAt: new Date() });
    const transaction = jest.spyOn(db, '$transaction');
    const res = responseRecorder();
    await handler({ params: { id: 'ticket-1' }, body: { assigneeId: 'manager-user' }, user: { userId: 'support-user' } }, res);
    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  test('un agent support peut assigner et résoudre un ticket avec audit et notification vendeur', async () => {
    const router = require('../routes.support');
    const handler = routeHandler(router, '/tickets/:id', 'patch');
    const now = new Date();
    jest.spyOn(db.supportTicket, 'findUnique').mockResolvedValue({
      id: 'ticket-1', reference: 'SUP-1', subject: 'Aide', status: 'OPEN', priority: 'NORMAL',
      assignedToId: null, resolvedAt: null, seller: { userId: 'seller-user' },
    });
    jest.spyOn(db.user, 'findUnique').mockResolvedValue({ role: 'support', emailVerifiedAt: now });
    const update = jest.fn().mockResolvedValue({
      id: 'ticket-1', reference: 'SUP-1', source: 'SELLER', category: 'Autre', subject: 'Aide',
      status: 'RESOLVED', priority: 'HIGH', requesterName: 'Aminata', requesterEmail: 'a@example.com',
      messages: [], lastMessageAt: now, resolvedAt: now, createdAt: now, updatedAt: now,
    });
    const auditCreate = jest.fn().mockResolvedValue({});
    const notificationCreate = jest.fn().mockResolvedValue({});
    jest.spyOn(db, '$transaction').mockImplementation((callback) => callback({
      supportTicket: { update }, auditLog: { create: auditCreate }, notification: { create: notificationCreate },
    }));
    const res = responseRecorder();
    await handler({
      params: { id: 'ticket-1' }, body: { status: 'RESOLVED', priority: 'HIGH', assignedToId: 'support-user' },
      user: { userId: 'support-user' }, headers: {}, ip: '127.0.0.1',
    }, res);
    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: 'RESOLVED', priority: 'HIGH', assignedToId: 'support-user', resolvedAt: expect.any(Date),
    }) }));
    expect(auditCreate).toHaveBeenCalled();
    expect(notificationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'seller-user' }) }));
  });

  test('le formulaire contact crée un ticket durable sans changer sa réponse publique', async () => {
    const router = require('../routes.contact');
    const handler = routeHandler(router, '/', 'post');
    jest.spyOn(supportService, 'createTicket').mockResolvedValue({ id: 'ticket-contact', reference: 'SUP-CONTACT' });
    jest.spyOn(emailService, 'sendContactMessageNotification').mockResolvedValue({ success: true, messageId: 'queued-1' });
    jest.spyOn(db.auditLog, 'create').mockResolvedValue({ id: 'audit-1' });
    const res = responseRecorder();
    await handler({ body: {
      name: 'Visiteur Test', email: 'visitor@example.com', subject: 'Question commande',
      message: 'Je souhaite obtenir une information sur ma commande.',
    }, headers: {}, ip: '127.0.0.1' }, res);
    expect(supportService.createTicket).toHaveBeenCalledWith(expect.objectContaining({ source: 'CONTACT' }));
    expect(res.payload).toEqual(expect.objectContaining({ success: true, ticketId: 'ticket-contact', reference: 'SUP-CONTACT' }));
  });

  test('le manager lit vendeurs et payouts mais ne peut pas les modifier', () => {
    const router = require('../routes.sellers');
    const next = jest.fn();
    const readRes = responseRecorder();
    routeMiddleware(router, '/admin/all', 'get', 1)({ user: { role: 'manager' } }, readRes, next);
    expect(next).toHaveBeenCalledTimes(1);
    routeMiddleware(router, '/admin/payouts', 'get', 1)({ user: { role: 'manager' } }, readRes, next);
    expect(next).toHaveBeenCalledTimes(2);

    const writeRes = responseRecorder();
    const writeNext = jest.fn();
    routeMiddleware(router, '/admin/payouts/:id/process', 'post', 1)({ user: { role: 'manager' } }, writeRes, writeNext);
    expect(writeRes.statusCode).toBe(403);
    expect(writeNext).not.toHaveBeenCalled();
  });
});
