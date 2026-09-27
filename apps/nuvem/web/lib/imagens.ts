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
  const response = await fetch("/api/imagens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imagem: await lerImagem(file) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro ?? "Falha ao enviar imagem.");
  if (typeof data.uid !== "string") throw new Error("Resposta de imagem inválida.");
  return data.uid;
}
