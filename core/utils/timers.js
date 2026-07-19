export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(predicate, {
  timeout = 30000,
  interval = 250,
  description = 'condition'
} = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch {
      // The condition may not be ready yet.
    }
    await delay(interval);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

export function debounce(fn, wait = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
