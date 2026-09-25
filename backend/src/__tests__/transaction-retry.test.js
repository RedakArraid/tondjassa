jest.mock('../db', () => ({ $transaction: jest.fn() }));
const db = require('../db');
const { transaction } = require('../services/transaction');
beforeEach(() => jest.resetAllMocks());
test.each([
  { code: 'P2034' },
  { code: 'P2010', meta: { code: '40001' } },
  { code: 'P2010', meta: { code: '40P01' } },
])('retries the full transaction after a recognized database conflict: %j', async (error) => {
  const work = jest.fn();
  db.$transaction.mockRejectedValueOnce(error).mockResolvedValueOnce('committed');
  await expect(transaction(work)).resolves.toBe('committed');
  expect(db.$transaction).toHaveBeenCalledTimes(2);
  expect(db.$transaction.mock.calls[1][0]).toBe(work);
});
test.each([
  { code: 'P2010', meta: { code: '23505' } },
  { code: 'P2010' },
  { code: 'P2002' },
  new Error('network or application failure'),
])('does not retry non-serialization failures: %j', async (error) => {
  db.$transaction.mockRejectedValue(error);
  await expect(transaction(jest.fn())).rejects.toBe(error);
  expect(db.$transaction).toHaveBeenCalledTimes(1);
});
test('bounds retries to five attempts', async () => {
  const error = { code: 'P2010', meta: { code: '40001' } };
  db.$transaction.mockRejectedValue(error);
  await expect(transaction(jest.fn())).rejects.toBe(error);
  expect(db.$transaction).toHaveBeenCalledTimes(5);
});
test('reuses the caller transaction without retrying a nested fragment', async () => {
  const tx = {}, error = { code: 'P2034' }, work = jest.fn().mockRejectedValue(error);
  await expect(transaction(work, tx)).rejects.toBe(error);
  expect(work).toHaveBeenCalledWith(tx);
  expect(db.$transaction).not.toHaveBeenCalled();
});
