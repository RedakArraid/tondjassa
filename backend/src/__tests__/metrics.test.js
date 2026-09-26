const Metrics = require('../services/metrics.service');

describe('low-cardinality operational metrics', () => {
  beforeEach(() => Metrics.resetForTests());

  test('counts method/status classes and duration without dynamic route labels', () => {
    Metrics.begin('GET')(200, 42);
    Metrics.begin('POST')(503, 1200);
    const output = Metrics.render();

    expect(output).toContain('mandemarket_http_requests_total{method="GET",status_class="2xx"} 1');
    expect(output).toContain('mandemarket_http_requests_total{method="POST",status_class="5xx"} 1');
    expect(output).toContain('mandemarket_http_request_duration_seconds_count 2');
    expect(output).toContain('mandemarket_http_requests_in_flight 0');
    expect(output).not.toContain('orderId');
    expect(output).not.toContain('email');
  });

  test('finish callback is idempotent', () => {
    const finish = Metrics.begin('GET');
    finish(200, 10);
    finish(500, 10);
    const output = Metrics.render();
    expect(output).toContain('status_class="2xx"} 1');
    expect(output).not.toContain('status_class="5xx"} 1');
  });
});
