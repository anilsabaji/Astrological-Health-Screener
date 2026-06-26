// title: fetch with exponential backoff retry
// tags: javascript, http, resilience, retry
// category: frontend
//
// Wraps fetch() with retries and exponential backoff. Use for flaky network
// calls to third-party APIs. Retries on network errors and 5xx responses.

async function fetchWithRetry(url, options = {}, { retries = 3, baseDelay = 300 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status >= 500 && attempt < retries) {
        throw new Error(`Server error ${res.status}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const delay = baseDelay * 2 ** attempt + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

module.exports = { fetchWithRetry };
