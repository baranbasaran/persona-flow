import { Client } from '@hubspot/api-client';

// HubSpot rate limits:
// - 100 requests per 10-second interval (average 10 req/sec)
// - Recommended: Stay under 80% of the limit
const MAX_REQUESTS_PER_SECOND = 8;

let hubspotClient: Client;
let lastRequestTime = Date.now();
let requestsInLastSecond = 0;

/**
 * Implements rate limiting for HubSpot API calls
 */
async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  // Reset counter if a second has passed
  if (timeSinceLastRequest >= 1000) {
    requestsInLastSecond = 0;
    lastRequestTime = now;
  }

  // If we're at the limit, wait until the next second
  if (requestsInLastSecond >= MAX_REQUESTS_PER_SECOND) {
    const waitTime = 1000 - timeSinceLastRequest;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return waitForRateLimit(); // Recursive call to check again
    }
  }

  requestsInLastSecond++;
}

/**
 * Initialize the HubSpot client with rate limiting wrapper
 */
export function connectHubspot() {
  const hubspotAccessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!hubspotAccessToken) {
    console.error('HubSpot access token is not set in environment variables');
    process.exit(1);
  }

  // Create the base client
  const baseClient = new Client({ 
    accessToken: hubspotAccessToken,
    defaultHeaders: {
      'User-Agent': 'PersonaFlow/1.0.0'
    }
  });

  const proxyHandler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      const original = target[prop];
      if (typeof original === 'function') {
        // Wrap functions to include rate limiting
        return async (...args: any[]) => {
          await waitForRateLimit();
          return original.apply(target, args);
        };
      }
      if (original && typeof original === 'object') {
        // Recursively wrap nested objects
        return new Proxy(original, proxyHandler);
      }
      return Reflect.get(target, prop, receiver);
    },
  };

  // Wrap the client's API methods with rate limiting
  hubspotClient = new Proxy(baseClient, proxyHandler);

  console.log('HubSpot client initialized with rate limiting');
}

export { hubspotClient }; 