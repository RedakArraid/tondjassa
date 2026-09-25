const Inventory = require('../services/inventory.service');
describe('Refund inventory operations', () => {
  test('restock restores physical and available units once, not reserved units', async () => {
    const tx = { inventory: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ available: 10 }) },
      orderItem: { update: jest.fn() }, product: { update: jest.fn() } };
    const item = { id: 'item', productId: 1, quantity: 2, stockCommittedAt: new Date(), stockRestoredAt: null };
    await Inventory.restock(tx, item);
    expect(tx.inventory.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: { increment: 2 }, available: { increment: 2 } }) }));
    expect(tx.orderItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: { stockRestoredAt: expect.any(Date) } }));
    await Inventory.restock(tx, { ...item, stockRestoredAt: new Date() });
    expect(tx.inventory.update).toHaveBeenCalledTimes(1);
  });
  test('cancellation does not invent physical stock', async () => {
    const tx = { inventory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ available: 10 }) },
      orderItem: { update: jest.fn() }, product: { update: jest.fn() } };
    await Inventory.release(tx, { id: 'item', productId: 1, quantity: 2 });
    const changes = tx.inventory.updateMany.mock.calls[0][0].data;
    expect(changes).not.toHaveProperty('quantity');
    expect(changes.reserved).toEqual({ decrement: 2 });
    expect(changes.available).toEqual({ increment: 2 });
  });
  test('inconsistent reservation is rejected, not silently made negative', async () => {
    await expect(Inventory.release({ inventory: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } }, { id: 'i', productId: 1, quantity: 2 })).rejects.toThrow('Reservation incoherente');
  });
});
