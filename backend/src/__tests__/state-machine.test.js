const mockDb = {
  $queryRaw: jest.fn().mockResolvedValue([]),
  order: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  payment: { update: jest.fn() }, orderItem: { updateMany: jest.fn() }, shipping: { updateMany: jest.fn() },
  auditLog: { create: jest.fn() }, $transaction: jest.fn((work) => work(mockDb)),
};
jest.mock('../db', () => mockDb);
jest.mock('../services/ledger.service', () => ({ makeOrderFundsAvailable: jest.fn(), recordOrderRefund: jest.fn() }));
const { OrderService } = require('../services/order.service');
const Ledger = require('../services/ledger.service');
describe('Actual order state transitions', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  test('illegal transition is rejected without writes', async () => {
    mockDb.order.findUnique.mockResolvedValue({ id: 'o', status: 'DELIVERED', items: [] });
    await expect(OrderService.transitionOrderStatus('o', 'PROCESSING')).rejects.toThrow('Transition');
    expect(mockDb.order.update).not.toHaveBeenCalled();
  });
  test('online order cannot be confirmed without completed payment', async () => {
    mockDb.order.findUnique.mockResolvedValue({ id: 'o', status: 'PENDING', items: [], payment: { status: 'PROCESSING', method: 'CARD' } });
    await expect(OrderService.transitionOrderStatus('o', 'CONFIRMED')).rejects.toThrow();
    expect(mockDb.order.update).not.toHaveBeenCalled();
  });
  test('refund state requires a confirmed provider result', async () => {
    mockDb.order.findUnique.mockResolvedValue({ id: 'o', status: 'DELIVERED', items: [] });
    await expect(OrderService.transitionOrderStatus('o', 'REFUNDED')).rejects.toThrow();
    expect(Ledger.recordOrderRefund).not.toHaveBeenCalled();
  });
  test('delivery releases funds only for a paid order', async () => {
    mockDb.order.findUnique.mockResolvedValue({ id: 'o', status: 'SHIPPED', items: [], payment: { status: 'PENDING', method: 'CASH_ON_DELIVERY' } });
    mockDb.order.update.mockResolvedValue({ id: 'o', status: 'DELIVERED' });
    await OrderService.transitionOrderStatus('o', 'DELIVERED');
    expect(Ledger.makeOrderFundsAvailable).not.toHaveBeenCalled();
    mockDb.order.findUnique.mockResolvedValue({ id: 'o', status: 'SHIPPED', items: [], payment: { status: 'COMPLETED' } });
    await OrderService.transitionOrderStatus('o', 'DELIVERED');
    expect(Ledger.makeOrderFundsAvailable).toHaveBeenCalledWith('o', mockDb);
  });
  test('repeated transition is idempotent', async () => {
    mockDb.order.findUnique.mockResolvedValue({ id: 'o', status: 'CANCELLED', items: [] });
    await OrderService.transitionOrderStatus('o', 'CANCELLED');
    expect(mockDb.order.update).not.toHaveBeenCalled();
  });
});
