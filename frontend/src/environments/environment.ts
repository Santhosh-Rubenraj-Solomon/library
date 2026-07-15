/**
 * Points at the nginx LOAD BALANCER (Task 2), not a single backend.
 * With the Docker stack up, requests to :8080 fan out across backend-1/-2/-3
 * and you can watch the `X-Served-By` header rotate in the Network tab.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
};
