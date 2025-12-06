/**
 * API Key Encryption Utilities
 *
 * Encrypts and decrypts API keys before storing in database.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Security:
 * - Keys are encrypted before storing in Convex
 * - Decryption only happens server-side
 * - Frontend never sees decrypted keys
 * - Uses environment variable for encryption key (must be set)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits for AES
const TAG_LENGTH = 16; // 128 bits for authentication tag
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Get encryption key from environment variable
 *
 * Requires ENCRYPTION_KEY to be a 32-byte (256-bit) hex string (64 hex characters).
 *
 * @returns Encryption key buffer (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const encryptionKeyEnv = process.env.ENCRYPTION_KEY;

  if (!encryptionKeyEnv) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required. Generate one with: openssl rand -hex 32",
    );
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(encryptionKeyEnv, "hex");

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). Current length: ${keyBuffer.length} bytes.`,
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a plaintext string
 *
 * Uses AES-256-GCM with a random IV for each encryption.
 * Returns a hex-encoded string containing: iv + authTag + encryptedData
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string (hex-encoded)
 * @throws Error if encryption fails or encryption key is missing
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || plaintext.trim().length === 0) {
    return "";
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt the data
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + encryptedData (all hex-encoded)
    // Format: iv(32 hex chars) + authTag(32 hex chars) + encryptedData(variable)
    const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

    return combined;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error(
      `Failed to encrypt data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Decrypt an encrypted string
 *
 * Decrypts a hex-encoded string that was encrypted with encrypt().
 * Validates authentication tag to ensure data integrity.
 *
 * @param encryptedData - The encrypted string (hex-encoded)
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails, authentication tag is invalid, or encryption key is missing
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || encryptedData.trim().length === 0) {
    return "";
  }

  try {
    const key = getEncryptionKey();

    // Extract components from combined string
    // Format: iv(32 hex) + authTag(32 hex) + encryptedData(variable)
    const ivHex = encryptedData.substring(0, IV_LENGTH * 2);
    const authTagHex = encryptedData.substring(IV_LENGTH * 2, IV_LENGTH * 2 + TAG_LENGTH * 2);
    const encryptedHex = encryptedData.substring(IV_LENGTH * 2 + TAG_LENGTH * 2);

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error(
      `Failed to decrypt data: ${error instanceof Error ? error.message : "Unknown error"}. The data may be corrupted or the encryption key may be incorrect.`,
    );
  }
}

/**
 * Check if a string is encrypted (has the expected format)
 *
 * @param data - String to check
 * @returns True if string appears to be encrypted
 */
export function isEncrypted(data: string): boolean {
  if (!data || data.length < (IV_LENGTH + TAG_LENGTH) * 2) {
    return false;
  }

  // Check if it's hex-encoded and has minimum length for iv + tag + some data
  return /^[0-9a-fA-F]+$/.test(data) && data.length > 100;
}

