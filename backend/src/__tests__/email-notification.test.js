const nodemailer = require('nodemailer');
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../services/order-access.service', () => ({ createOrderToken: () => 'test-capability' }));
const email = require('../services/email.service');
const original = { ...process.env };
const sendMail = jest.fn();
beforeEach(() => {
  Object.assign(process.env, { NODE_ENV: 'production', SMTP_HOST: 'mail.test.invalid', SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASS: 'test-only', ADMIN_EMAIL: 'admin@test.invalid' });
  sendMail.mockReset().mockResolvedValue({ messageId: 'test-id' });
  nodemailer.createTransport.mockReturnValue({ sendMail });
});
afterAll(() => { process.env = original; });
test('new-order notification is exported, delivered to configured admin and HTML escaped', async () => {
  const result = await email.sendNewOrderNotification({ id: 'test-order', orderNumber: '<img src=x>', totalAmount: 2400000, status: 'PENDING' });
  expect(result.success).toBe(true);
  const message = sendMail.mock.calls[0][0];
  expect(message.to).toBe('admin@test.invalid');
  expect(message.html).toContain('&lt;img src=x&gt;');
  expect(message.html).not.toContain('<img src=x>');
  expect(message.html).not.toContain('#token=');
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true }));
});
test('unpaid order receipt does not announce a confirmed payment', async () => {
  await email.sendOrderConfirmation({ email: 'guest@test.invalid', firstName: 'QA' }, { id: 'test-order', totalAmount: 100000, status: 'PENDING', items: [] });
  expect(sendMail.mock.calls[0][0].subject).toContain('enregistree');
});
