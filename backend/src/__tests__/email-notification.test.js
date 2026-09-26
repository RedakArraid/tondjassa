const nodemailer = require('nodemailer');
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../services/order-access.service', () => ({ createOrderToken: () => 'test-capability' }));
const mockCreate = jest.fn();
const mockUpsert = jest.fn();
jest.mock('../db', () => ({ emailOutbox: { create: mockCreate, upsert: mockUpsert } }));
const email = require('../services/email.service');
const original = { ...process.env };
const sendMail = jest.fn();
beforeEach(() => {
  Object.assign(process.env, { NODE_ENV: 'production', SMTP_HOST: 'mail.test.invalid', SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASS: 'test-only', ADMIN_EMAIL: 'admin@test.invalid' });
  sendMail.mockReset().mockResolvedValue({ messageId: 'test-id' });
  nodemailer.createTransport.mockReturnValue({ sendMail });
  mockCreate.mockReset().mockImplementation(async ({ data }) => ({ id: 'outbox-create', status: 'PENDING', ...data }));
  mockUpsert.mockReset().mockImplementation(async ({ create }) => ({ id: 'outbox-upsert', status: 'PENDING', ...create }));
});
afterAll(() => { process.env = original; });
test('new-order notification is exported, delivered to configured admin and HTML escaped', async () => {
  const result = await email.sendNewOrderNotification({ id: 'test-order', orderNumber: '<img src=x>', totalAmount: 2400000, status: 'PENDING' });
  expect(result.success).toBe(true);
  expect(result.queued).toBe(true);
  const queued = mockUpsert.mock.calls[0][0].create;
  expect(queued.recipient).toBe('admin@test.invalid');
  expect(queued.payload.html).toContain('&lt;img src=x&gt;');
  expect(queued.payload.html).not.toContain('<img src=x>');
  expect(queued.payload.html).not.toContain('#token=');
  expect(sendMail).not.toHaveBeenCalled();
  await email.deliverEmail(queued);
  const message = sendMail.mock.calls[0][0];
  expect(message.to).toBe('admin@test.invalid');
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true }));
});
test('seller customer message escapes seller-controlled content', async () => {
  await email.sendSellerCustomerMessage({
    to: 'customer@test.invalid',
    customerName: '<Client>',
    storeName: '<Boutique>',
    subject: 'Commande <script>',
    message: 'Bonjour <img src=x onerror=alert(1)>',
  });
  const queued = mockCreate.mock.calls[0][0].data;
  await email.deliverEmail(queued);
  const message = sendMail.mock.calls[0][0];
  expect(message.to).toBe('customer@test.invalid');
  expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(message.html).not.toContain('<img src=x onerror=alert(1)>');
  expect(message.subject).not.toContain('<Boutique>');
});

test('unpaid order receipt does not announce a confirmed payment', async () => {
  await email.sendOrderConfirmation({ email: 'guest@test.invalid', firstName: 'QA' }, { id: 'test-order', totalAmount: 100000, status: 'PENDING', items: [] });
  expect(mockUpsert.mock.calls[0][0].create.payload.subject).toContain('enregistree');
});
