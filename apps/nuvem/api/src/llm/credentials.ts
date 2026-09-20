import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";

function key(): Buffer {
  const value = process.env.LLM_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new ServiceUnavailableException("Proteção das credenciais LLM não configurada");
  }
  return Buffer.from(value, "hex");
}

export function encrypt(value: string, uid: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(uid));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decrypt(value: string, uid: string): string {
  try {
    const [version, nonce, tag, data, extra] = value.split(".");
    if (version !== "v1" || !nonce || !tag || !data || extra) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(nonce, "base64"));
    decipher.setAAD(Buffer.from(uid));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new ServiceUnavailableException("Credencial LLM indisponível; confira a configuração do servidor");
  }
}
