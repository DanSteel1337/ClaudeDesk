// Basic encryption utility (placeholder - use a robust library for production)
// This is a simplified example. For real applications, use Web Crypto API directly
// or a well-vetted library. This example is NOT secure for production.
// It also assumes client-side usage. For server-side, use Node's crypto.

// THIS IS A PLACEHOLDER AND NOT SECURE FOR PRODUCTION API KEYS.
// A proper implementation would involve deriving a key from a user password or using a dedicated key management system.
// For client-side encryption of an API key to be stored in DB, it's more about obfuscation
// as the key to decrypt it would also need to be available to the client or server.
// True security for API keys often involves server-side storage and never exposing them to the client.
// However, if the user provides THEIR OWN key, this is about protecting it at rest in *your* DB.

const KEY_STRING = process.env.ENCRYPTION_KEY || "a_very_secret_key_32_chars_long" // MUST BE 32 chars for AES-256. Store in .env

async function getKeyMaterial(keyString: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    "raw",
    enc.encode(keyString.slice(0, 32)), // Ensure it's 32 bytes for AES-256
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function encryptApiKey(apiKey: string): Promise<string> {
  if (!apiKey) return ""
  try {
    const keyMaterial = await getKeyMaterial(KEY_STRING)
    const iv = crypto.getRandomValues(new Uint8Array(12)) // Initialization vector
    const encodedApiKey = new TextEncoder().encode(apiKey)

    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, keyMaterial, encodedApiKey)

    // Combine IV and ciphertext, then base64 encode
    const buffer = new Uint8Array(iv.byteLength + ciphertext.byteLength)
    buffer.set(new Uint8Array(iv), 0)
    buffer.set(new Uint8Array(ciphertext), iv.byteLength)
    return btoa(String.fromCharCode(...buffer)) // Convert buffer to string then base64
  } catch (error) {
    console.error("Encryption failed:", error)
    throw new Error("Encryption failed")
  }
}

export async function decryptApiKey(encryptedData: string): Promise<string> {
  if (!encryptedData) return ""
  try {
    const keyMaterial = await getKeyMaterial(KEY_STRING)
    const dataBuffer = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0))

    const iv = dataBuffer.slice(0, 12)
    const ciphertext = dataBuffer.slice(12)

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, keyMaterial, ciphertext)

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error("Decryption failed:", error)
    // It's common for decryption to fail if key is wrong or data corrupted.
    // Don't throw raw error, could leak info.
    throw new Error("Decryption failed. Invalid key or data.")
  }
}
