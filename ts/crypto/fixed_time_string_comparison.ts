import memoizee from "memoizee";


const getHmacKey = memoizee(
  async (): Promise<CryptoKey> => {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    return crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  },
  { promise: true }
);

export async function fixedTimeStringEquals(a: string, b: string): Promise<boolean> {
  const key = await getHmacKey();
  const sigA = await crypto.subtle.sign("HMAC", key, (new TextEncoder()).encode(a));
  // Constant-time verify: succeeds iff b === a (under the same key)
  return crypto.subtle.verify("HMAC", key, sigA, (new TextEncoder()).encode(b));
}
