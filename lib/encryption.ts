// Simple client-side encryption for API keys
// In production, consider using a more robust encryption library

export async function encryptApiKey(apiKey: string): Promise<string> {
  // TODO: Implement proper client-side encryption
  // For now, we'll use base64 encoding as a placeholder
  // In production, use proper encryption with a user-derived key
  return btoa(apiKey)
}

export async function decryptApiKey(encryptedKey: string): Promise<string> {
  // TODO: Implement proper client-side decryption
  // For now, we'll use base64 decoding as a placeholder
  try {
    return atob(encryptedKey)
  } catch {
    throw new Error("Invalid encrypted API key")
  }
}
