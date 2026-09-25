const paystackService = require('../services/paystack.service');
const cinetpayService = require('../services/cinetpay.service');
const crypto = require('crypto');

describe('Payment Engine Tests (Phase 4 - MM-BE-040 / MM-BE-041 / MM-BE-042)', () => {
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;

  beforeAll(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_paystack_secret_key_12345';
  });

  afterAll(() => {
    process.env.PAYSTACK_SECRET_KEY = originalSecret;
  });

  describe('Paystack Security & Webhook Signatures (MM-BE-042)', () => {
    test('verifyWebhookSignature returns true for valid HMAC SHA512', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123' } });
      const signature = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex');

      const isValid = paystackService.verifyWebhookSignature(payload, signature);
      expect(isValid).toBe(true);
    });

    test('verifyWebhookSignature returns false for tampered payload', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123' } });
      const signature = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex');

      const tamperedPayload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_tampered' } });
      const isValid = paystackService.verifyWebhookSignature(tamperedPayload, signature);
      expect(isValid).toBe(false);
    });

    test('provider codes match Paystack CIV documentation', () => {
      const { OPERATOR_SLUG } = require('../services/paystack.service');
      expect(OPERATOR_SLUG['mtn_momo']).toBe('mtn');
      expect(OPERATOR_SLUG['wave']).toBe('wave');
      expect(OPERATOR_SLUG['orange_money']).toBe('orange');
    });
  });

  describe('CinetPay Security & Token Verification (MM-BE-041)', () => {
    test('verifyNotificationToken checks HMAC-SHA256 hash', () => {
      process.env.CINETPAY_SECRET_KEY = 'cinetpay_secret_key_test';
      const rawBody = JSON.stringify({ cpm_trans_id: 'MM-ORDER-1234', cpm_result: '00' });
      const validToken = crypto
        .createHmac('sha256', process.env.CINETPAY_SECRET_KEY)
        .update(rawBody)
        .digest('hex');

      const isValid = cinetpayService.verifyNotificationToken(validToken, rawBody);
      expect(isValid).toBe(true);

      const isInvalid = cinetpayService.verifyNotificationToken('fake-token', rawBody);
      expect(isInvalid).toBe(false);
    });
  });
});
