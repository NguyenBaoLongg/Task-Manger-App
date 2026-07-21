import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 2),
      duration: __ENV.DURATION || '10s',
    },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500'] },
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL || 'http://127.0.0.1:3000'}/health/live`);
  check(response, { 'liveness is 200': (result) => result.status === 200 });
  sleep(0.2);
}
