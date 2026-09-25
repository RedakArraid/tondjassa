const db = require('../db');
const jwt = require('jsonwebtoken');
const sessionService = require('../services/session.service');

describe('Session & Auth Security Tests (MM-BE-021 / MM-BE-022)', () => {
  test('hashToken produit un hash sha256 déterministe', () => {
    const raw = 'my-super-secret-token-12345';
    const hash1 = sessionService.hashToken(raw);
    const hash2 = sessionService.hashToken(raw);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  test('generateAccessToken inclut les claims nécessaires', () => {
    const user = { id: 'u-1', email: 'test@mande.ci', role: 'customer' };
    const token = sessionService.generateAccessToken(user, 'session-123');
    expect(jwt.decode(token).sid).toBe('session-123');
    expect(jwt.decode(token).aud).toBe('access');

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // Format JWT (header.payload.signature)
  });

  test('createPasswordResetToken retourne null sans divulguer l existence pour un email inconnu', async () => {
    const lookup = jest.spyOn(db.user, 'findUnique').mockResolvedValueOnce(null);
    const result = await sessionService.createPasswordResetToken('nonexistent-email-99999@mandemarket.com');
    expect(result).toBeNull();
    lookup.mockRestore();
  });
});
