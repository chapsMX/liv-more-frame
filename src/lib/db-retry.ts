/**
 * Retry helper for Neon DB operations.
 * Neon in serverless sometimes needs to "wake up" (cold start).
 * Retries on connection errors (UND_ERR_SOCKET, fetch failed).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const e = err as { cause?: { code?: string }; message?: string };
      const causeCode = e?.cause?.code;
      const isConnError =
        causeCode === "UND_ERR_SOCKET" ||
        e?.message === "fetch failed" ||
        (typeof e?.message === "string" && e.message.includes("Error connecting to database"));

      if (isConnError && i < retries - 1) {
        const delay = 500 * (i + 1); // 500ms, 1000ms, 1500ms
        console.warn(`[DB] Connection failed, retry ${i + 1}/${retries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("withRetry: unreachable");
}
