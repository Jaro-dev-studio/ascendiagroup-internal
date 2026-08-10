import "server-only";

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret =
    process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "";

  if (!secret) {
    throw new Error(
      "APP_ENCRYPTION_KEY or NEXTAUTH_SECRET must be set to store integration credentials"
    );
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptJson<T = Record<string, string>>(
  payload?: string | null
): T | null {
  if (!payload) return null;

  try {
    const [ivPart, tagPart, dataPart] = payload.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivPart, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch (error) {
    console.error("[Crypto] failed to decrypt stored credentials", error);
    return null;
  }
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
