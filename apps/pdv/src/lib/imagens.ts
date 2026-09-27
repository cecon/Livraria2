import { invoke } from "@tauri-apps/api/core";
export async function lerImagem(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter até 5 MB.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
export async function enviarImagem(file: File): Promise<string> {
  return invoke("imagem_enviar", { imagem: await lerImagem(file) });
}
