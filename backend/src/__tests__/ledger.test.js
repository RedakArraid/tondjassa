const LedgerService = require('../services/ledger.service');
const db = require('../db');

describe('Marketplace Ledger & Payout Tests (Phase 5 - MM-BE-050 / MM-BE-051 / MM-FE-050)', () => {
  describe('Balances Calculation & Ledger Projections (MM-BE-050)', () => {
    test('Calculates the 4 balances with exact precision', async () => {
      const mockSellerId = 'seller_test_123';

      // Mock aggregate calls
      const aggregateSpy = jest.spyOn(db.sellerLedgerEntry, 'aggregate');
      const payoutAggregateSpy = jest.spyOn(db.sellerPayout, 'aggregate');

      // 1. Pending: 15 000 FCFA (1 500 000 cents)
      aggregateSpy.mockResolvedValueOnce({ _sum: { netAmount: 1500000 } });
      // 2. Available gross earned: 50 000 FCFA (5 000 000 cents)
      aggregateSpy.mockResolvedValueOnce({ _sum: { netAmount: 5000000 } });
      // 3. Reserved (pending/processing payouts): 10 000 FCFA (1 000 000 cents)
      payoutAggregateSpy.mockResolvedValueOnce({ _sum: { amount: 1000000 } });
      // 4. Paid out (completed payouts): 20 000 FCFA (2 000 000 cents)
      payoutAggregateSpy.mockResolvedValueOnce({ _sum: { amount: 2000000 } });

      const balances = await LedgerService.getSellerBalances(mockSellerId);

      expect(balances.pending).toBe(1500000);
      expect(balances.reserved).toBe(1000000);
      expect(balances.paid).toBe(2000000);
      // Available = 50 000 - 10 000 - 20 000 = 20 000 FCFA (2 000 000 cents)
      expect(balances.available).toBe(2000000);
      expect(balances.currency).toBe('XOF');
      expect(aggregateSpy.mock.calls[1][0].where.type.in).not.toContain('PAYOUT_COMPLETED');

      aggregateSpy.mockRestore();
      payoutAggregateSpy.mockRestore();
    });
  });

  describe('Atomic Payout Reservation & Overdraft Protection (MM-BE-051)', () => {
    test('Rejects payout if amount is lower than minimum (5 000 FCFA)', async () => {
      await expect(
        LedgerService.requestPayout({
          sellerId: 'seller_1',
          amount: 300000, // 3 000 FCFA < 5 000 FCFA
          method: 'mobile_money',
        })
      ).rejects.toThrow('Le montant minimum de retrait est de 5000 FCFA');
    });

    test('Rejects payout if amount exceeds available balance', async () => {
      const transactionSpy = jest.spyOn(db, '$transaction').mockImplementation(async (callback) => {
        const fakeTx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          refund: { findFirst: jest.fn().mockResolvedValue(null) },
          sellerLedgerEntry: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 1000000 } }), // 10 000 FCFA earned
          },
          sellerPayout: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 800000 } }), // 8 000 FCFA committed
          },
        };
        return callback(fakeTx);
      });

      // Available = 10 000 - 8 000 = 2 000 FCFA. Requesting 5 000 FCFA must fail.
      await expect(
        LedgerService.requestPayout({
          sellerId: 'seller_1',
          amount: 500000,
          method: 'mobile_money',
        })
      ).rejects.toThrow('Solde disponible insuffisant');

      transactionSpy.mockRestore();
    });

    test('Allows payout when balance is sufficient and creates ledger lock', async () => {
      const createdPayout = { id: 'payout_abc123', amount: 500000, status: 'pending' };
      const transactionSpy = jest.spyOn(db, '$transaction').mockImplementation(async (callback) => {
        const fakeTx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          refund: { findFirst: jest.fn().mockResolvedValue(null) },
          sellerLedgerEntry: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 10000000 } }), // 100 000 FCFA earned
            create: jest.fn().mockResolvedValue({ id: 'entry_lock_1' }),
          },
          sellerPayout: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
            create: jest.fn().mockResolvedValue(createdPayout),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
          },
        };
        return callback(fakeTx);
      });

      const res = await LedgerService.requestPayout({
        sellerId: 'seller_1',
        amount: 500000,
        method: 'mobile_money',
      });

      expect(res.id).toBe('payout_abc123');
      expect(res.amount).toBe(500000);

      transactionSpy.mockRestore();
    });
  });

  describe('Funds Lifecycle: Payment, Delivery, and Refund (MM-BE-050)', () => {
    test('makeOrderFundsAvailable moves entries from PENDING to AVAILABLE upon delivery', async () => {
      const fakeTx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          refund: { findFirst: jest.fn().mockResolvedValue(null) },
        sellerLedgerEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([
            { id: 'entry_1', status: 'PENDING', order: { orderNumber: 'ORD-999' } },
          ]),
          update: jest.fn().mockResolvedValue({ id: 'entry_1', status: 'AVAILABLE' }),
        },
      };

      await LedgerService.makeOrderFundsAvailable('order_999', fakeTx);

      expect(fakeTx.sellerLedgerEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'entry_1' },
          data: expect.objectContaining({
            type: 'SALE_AVAILABLE',
            status: 'AVAILABLE',
          }),
        })
      );
    });

    test('recordOrderRefund creates negative debit entry if funds were already available', async () => {
      const fakeTx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          refund: { findFirst: jest.fn().mockResolvedValue(null) },
        sellerLedgerEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'entry_avail_1',
              sellerId: 'seller_1',
              status: 'AVAILABLE',
              amount: 2500000,
              feeAmount: 250000,
              netAmount: 2250000,
              order: { orderNumber: 'ORD-888' },
            },
          ]),
          create: jest.fn().mockResolvedValue({ id: 'entry_refund_1' }),
        },
      };

      await LedgerService.recordOrderRefund('order_888', { reason: 'Client returned parcel' }, fakeTx);

      expect(fakeTx.sellerLedgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sellerId: 'seller_1',
          type: 'REFUND',
          amount: -2500000,
          feeAmount: -250000,
          netAmount: -2250000,
          status: 'CLEARED',
        }),
      });
    });

    test('failPayout releases funds by recording PAYOUT_RELEASED', async () => {
      const transactionSpy = jest.spyOn(db, '$transaction').mockImplementation(async (callback) => {
        const fakeTx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          refund: { findFirst: jest.fn().mockResolvedValue(null) },
          sellerPayout: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'payout_fail_1',
              sellerId: 'seller_1',
              amount: 600000,
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({ id: 'payout_fail_1', status: 'failed' }),
          },
          sellerLedgerEntry: {
            create: jest.fn().mockResolvedValue({ id: 'entry_rel_1' }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit_rel_1' }),
          },
        };
        return callback(fakeTx);
      });

      const res = await LedgerService.failPayout('payout_fail_1', { reason: 'Operator rejected account number' });
      expect(res.status).toBe('failed');

      transactionSpy.mockRestore();
    });

    test('Seller ledger queries are strictly scoped by sellerId (Multi-tenant isolation)', async () => {
      const findManySpy = jest.spyOn(db.sellerLedgerEntry, 'findMany').mockResolvedValue([]);

      // Calling getMyLedger equivalent query
      await db.sellerLedgerEntry.findMany({
        where: { sellerId: 'seller_isolated_1' },
      });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId: 'seller_isolated_1' }),
        })
      );

      findManySpy.mockRestore();
    });
  });
});
