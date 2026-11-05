import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type CredentialContext = {
  workspaceId: string;
  recordId: string;
  provider: "google_ads" | "meta_ads";
  purpose: "provider_credentials" | "oauth_pkce_verifier";
};

export type EncryptedValue = {
  algorithm: "aes-256-gcm";
  keyVersion: string;
  ciphertext: string;
};

export class CredentialCipherError extends Error {
  constructor() {
    super("Credential encryption is unavailable.");
    this.name = "CredentialCipherError";
  }
}

export class CredentialCipher {
  constructor(
    private readonly activeKeyVersion: string,
    private readonly keyRing: ReadonlyMap<string, Buffer>,
  ) {
    if (!keyRing.has(activeKeyVersion)) throw new CredentialCipherError();
    for (const key of keyRing.values()) {
      if (key.byteLength !== 32) throw new CredentialCipherError();
    }
  }

  static fromEnvironment(
    activeKeyVersion: string | undefined,
    serializedKeyRing: string | undefined,
  ): CredentialCipher | null {
    if (!activeKeyVersion || !serializedKeyRing) return null;
    try {
      const parsed: unknown = JSON.parse(serializedKeyRing);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const keyRing = new Map<string, Buffer>();
      for (const [version, encoded] of Object.entries(parsed)) {
        if (!/^v[1-9][0-9]*$/.test(version) || typeof encoded !== "string") return null;
        const key = Buffer.from(encoded, "base64");
        if (key.byteLength !== 32 || key.toString("base64") !== encoded) return null;
        keyRing.set(version, key);
      }
      return new CredentialCipher(activeKeyVersion, keyRing);
    } catch {
      return null;
    }
  }

  encrypt(plaintext: string, context: CredentialContext): EncryptedValue {
    const key = this.keyRing.get(this.activeKeyVersion);
    if (!key) throw new CredentialCipherError();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(this.additionalData(context, this.activeKeyVersion));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      algorithm: "aes-256-gcm",
      keyVersion: this.activeKeyVersion,
      ciphertext: [nonce, tag, ciphertext].map((value) => value.toString("base64url")).join("."),
    };
  }

  decrypt(value: EncryptedValue, context: CredentialContext): string {
    const key = this.keyRing.get(value.keyVersion);
    if (!key || value.algorithm !== "aes-256-gcm") throw new CredentialCipherError();
    const parts = value.ciphertext.split(".");
    if (parts.length !== 3) throw new CredentialCipherError();
    try {
      const nonce = Buffer.from(parts[0] ?? "", "base64url");
      const tag = Buffer.from(parts[1] ?? "", "base64url");
      const ciphertext = Buffer.from(parts[2] ?? "", "base64url");
      if (nonce.byteLength !== 12 || tag.byteLength !== 16) throw new CredentialCipherError();
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAAD(this.additionalData(context, value.keyVersion));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw new CredentialCipherError();
    }
  }

  private additionalData(context: CredentialContext, keyVersion: string): Buffer {
    return Buffer.from([
      "tandem-ads",
      context.workspaceId,
      context.recordId,
      context.provider,
      context.purpose,
      keyVersion,
    ].join(":"), "utf8");
  }
}
