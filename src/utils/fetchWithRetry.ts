/**
 * Retries a fetch function up to `retries` times with exponential backoff.
 * Use for critical fetches that block rendering (e.g. patient data, plans).
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<{ data: T | null; error: unknown }>,
  retries = 2,
  delay = 1000
): Promise<{ data: T | null; error: unknown }> {
  for (let i = 0; i <= retries; i++) {
    const result = await fn();
    if (!result.error) return result;
    if (i < retries) await new Promise(r => setTimeout(r, delay * (i + 1)));
  }
  return { data: null, error: new Error('Max retries reached') };
}
