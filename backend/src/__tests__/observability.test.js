const http = require('http');
process.env.METRICS_TOKEN = 'test-monitoring-token-0123456789abcdef';
const app = require('../app');
const db = require('../db');

jest.mock('../db', () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
}));

describe('Observabilité & Healthchecks (MM-INF-091 / MM-INF-092 / MM-QA-090)', () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('GET /health/live répond avec 200 et le statut LIVE', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('LIVE');
    expect(body).toHaveProperty('uptime');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('GET /health/ready vérifie la disponibilité de PostgreSQL et retourne 200', async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('READY');
    expect(body.database).toBe('CONNECTED');
    expect(body.version).toBe('2.0.0');
  });

  it('protège les indicateurs externes avec le jeton opérationnel', async () => {
    const denied = await fetch(`${baseUrl}/health/external`);
    expect(denied.status).toBe(404);

    const res = await fetch(`${baseUrl}/health/external`, {
      headers: { Authorization: `Bearer ${process.env.METRICS_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.stripe).toBe('boolean');
    expect(typeof body.paystack).toBe('boolean');
    expect(typeof body.cloudinary).toBe('boolean');
    expect(typeof body.email).toBe('boolean');

    const rawText = JSON.stringify(body);
    expect(rawText).not.toMatch(/sk_live|sk_test|apiKey|secret/i);
  });

  it('protège les métriques et les expose au format Prometheus avec authentification', async () => {
    const denied = await fetch(`${baseUrl}/api/internal/metrics`);
    expect(denied.status).toBe(404);

    const res = await fetch(`${baseUrl}/api/internal/metrics`, {
      headers: { Authorization: `Bearer ${process.env.METRICS_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('mandemarket_http_requests_total');
    expect(body).toContain('mandemarket_http_request_duration_seconds');
  });

  it('Génère ou propage un X-Request-ID unique pour chaque requête', async () => {
    const customId = 'req-trace-test-12345';
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Request-ID': customId },
    });
    expect(res.headers.get('x-request-id')).toBe(customId);
  });
});
