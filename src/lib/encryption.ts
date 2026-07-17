import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;

type EncryptionKey = {
  id: string;
  key: Buffer;
};

type EncryptionKeyring = {
  active: EncryptionKey;
  previous: Map<string, Buffer>;
};

let cachedSignature = "";
let cachedKeyring: EncryptionKeyring | null = null;

function decodeKey(value: string | undefined, variableName: string) {
  const encoded = value?.trim();

  if (!encoded) {
    throw new Error(`${variableName} is missing`);
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error(`${variableName} must be valid base64`);
  }

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error(`${variableName} must decode to exactly 32 bytes`);
  }

  return key;
}

function parsePreviousKeys(value: string | undefined, activeId: string) {
  const keys = new Map<string, Buffer>();

  for (const rawEntry of value?.split(",") ?? []) {
    const entry = rawEntry.trim();
    if (!entry) continue;

    const separator = entry.indexOf("=");

    if (separator <= 0) {
      throw new Error(
        "ENCRYPTION_PREVIOUS_KEYS must use keyId=base64 entries",
      );
    }

    const keyId = entry.slice(0, separator).trim();
    const encodedKey = entry.slice(separator + 1).trim();

    if (!KEY_ID_PATTERN.test(keyId)) {
      throw new Error(`Invalid previous encryption key id: ${keyId}`);
    }

    if (keyId === activeId || keys.has(keyId)) {
      throw new Error(`Duplicate encryption key id: ${keyId}`);
    }

    keys.set(
      keyId,
      decodeKey(encodedKey, `ENCRYPTION_PREVIOUS_KEYS[${keyId}]`),
    );
  }

  return keys;
}

function getKeyring() {
  const activeId = process.env.ENCRYPTION_KEY_ID?.trim() || "primary";
  const signature = [
    activeId,
    process.env.ENCRYPTION_KEY || "",
    process.env.ENCRYPTION_PREVIOUS_KEYS || "",
  ].join("\u0000");

  if (cachedKeyring && signature === cachedSignature) {
    return cachedKeyring;
  }

  if (!KEY_ID_PATTERN.test(activeId)) {
    throw new Error(
      "ENCRYPTION_KEY_ID must contain only letters, numbers, dot, underscore, or dash",
    );
  }

  const keyring = {
    active: {
      id: activeId,
      key: decodeKey(process.env.ENCRYPTION_KEY, "ENCRYPTION_KEY"),
    },
    previous: parsePreviousKeys(
      process.env.ENCRYPTION_PREVIOUS_KEYS,
      activeId,
    ),
  };

  cachedSignature = signature;
  cachedKeyring = keyring;
  return keyring;
}

function decodePayloadPart(value: string, label: string) {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`Encrypted value contains invalid ${label}`);
  }

  return Buffer.from(value, "base64");
}

function decryptPayload(
  key: Buffer,
  ivRaw: string,
  tagRaw: string,
  encryptedRaw: string,
) {
  const iv = decodePayloadPart(ivRaw, "IV");
  const tag = decodePayloadPart(tagRaw, "authentication tag");
  const encrypted = decodePayloadPart(encryptedRaw, "ciphertext");

  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new Error("Encrypted value has an invalid structure");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptText(value?: string | null) {
  if (!value) return value;

  const { active } = getKeyring();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, active.key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "enc",
    "v2",
    active.id,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptText(value?: string | null) {
  if (!value) return value;
  if (!value.startsWith("enc:")) return value;

  const keyring = getKeyring();
  const parts = value.split(":");

  if (parts.length === 6 && parts[1] === "v2") {
    const [, , keyId, ivRaw, tagRaw, encryptedRaw] = parts;
    const key =
      keyId === keyring.active.id
        ? keyring.active.key
        : keyring.previous.get(keyId);

    if (!key) {
      throw new Error(`Encryption key is unavailable for key id: ${keyId}`);
    }

    return decryptPayload(key, ivRaw, tagRaw, encryptedRaw);
  }

  if (parts.length === 4) {
    const [, ivRaw, tagRaw, encryptedRaw] = parts;
    const legacyKeys = [
      keyring.active.key,
      ...keyring.previous.values(),
    ];

    for (const key of legacyKeys) {
      try {
        return decryptPayload(key, ivRaw, tagRaw, encryptedRaw);
      } catch {
        // Legacy ciphertext has no key id, so each configured key must be tried.
      }
    }

    throw new Error("Unable to decrypt legacy encrypted value");
  }

  throw new Error("Encrypted value has an unsupported format");
}

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhone(value?: string | null) {
  if (!value) return null;
  return value.replace(/[^\d+]/g, "").trim() || null;
}

export function hashSearchValue(value?: string | null) {
  if (!value) return null;

  const secret = process.env.SEARCH_HASH_SECRET;

  if (!secret) {
    throw new Error("SEARCH_HASH_SECRET is required");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");
}
