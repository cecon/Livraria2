export type StockFormat = "pdf" | "xlsx";

export async function fetchStockFile(format: StockFormat): Promise<File> {
  const response = await fetch(`/api/relatorios/estoque/${format}`, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.erro ?? "Nao foi possivel gerar o arquivo.");
  }
  const type = format === "pdf" ? "application/pdf" :
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new File([await response.blob()], `estoque-${date}.${format}`, { type });
}

export function downloadStockFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function shareStockPdf(preloaded?: File): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = preloaded ?? await fetchStockFile("pdf");
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }
  downloadStockFile(file);
  return "downloaded";
}
