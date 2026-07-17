import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { decryptText, encryptText } from "../../src/lib/encryption";

function legacyEncrypt(value: string, key: Buffer) {
  const iv = Buffer.alloc(12, 7);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return [
    "enc",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

test("encryption keyring reads new and legacy ciphertext during rotation", () => {
  const original = {
    key: process.env.ENCRYPTION_KEY,
    keyId: process.env.ENCRYPTION_KEY_ID,
    previous: process.env.ENCRYPTION_PREVIOUS_KEYS,
  };
  const oldKey = Buffer.alloc(32, 11);
  const newKey = Buffer.alloc(32, 22);

  try {
    process.env.ENCRYPTION_KEY = oldKey.toString("base64");
    process.env.ENCRYPTION_KEY_ID = "key-2026-01";
    delete process.env.ENCRYPTION_PREVIOUS_KEYS;

    const versionedCiphertext = encryptText("بيانات موكل حساسة");
    const legacyCiphertext = legacyEncrypt("legacy value", oldKey);

    assert.match(versionedCiphertext || "", /^enc:v2:key-2026-01:/);
    assert.equal(decryptText(versionedCiphertext), "بيانات موكل حساسة");

    process.env.ENCRYPTION_KEY = newKey.toString("base64");
    process.env.ENCRYPTION_KEY_ID = "key-2026-02";
    process.env.ENCRYPTION_PREVIOUS_KEYS =
      `key-2026-01=${oldKey.toString("base64")}`;

    assert.equal(decryptText(versionedCiphertext), "بيانات موكل حساسة");
    assert.equal(decryptText(legacyCiphertext), "legacy value");

    delete process.env.ENCRYPTION_PREVIOUS_KEYS;
    assert.throws(
      () => decryptText(versionedCiphertext),
      /Encryption key is unavailable/,
    );
  } finally {
    if (original.key === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original.key;

    if (original.keyId === undefined) delete process.env.ENCRYPTION_KEY_ID;
    else process.env.ENCRYPTION_KEY_ID = original.keyId;

    if (original.previous === undefined) {
      delete process.env.ENCRYPTION_PREVIOUS_KEYS;
    } else {
      process.env.ENCRYPTION_PREVIOUS_KEYS = original.previous;
    }
  }
});
