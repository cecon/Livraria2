const INVISIBLE_CHARS = /[\uFEFF\u200B\u200C\u200D]/g;

export function cleanEnv(value: string | undefined) {
  return value?.replace(INVISIBLE_CHARS, "").trim();
}

export function requiredEnv(name: string) {
  const value = cleanEnv(process.env[name]);
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}
