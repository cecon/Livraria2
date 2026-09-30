import { afterEach, describe, expect, it, vi } from "vitest";
import { shareStockPdf } from "../stock-export";

afterEach(() => vi.unstubAllGlobals());

describe("compartilhamento do relatorio de estoque", () => {
  const pdf = { name: "estoque.pdf" } as File;

  it("envia somente o PDF, sem titulo ou texto separado", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: vi.fn().mockReturnValue(true), share });

    expect(await shareStockPdf(pdf)).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ files: [pdf] });
  });

  it("nao baixa outro arquivo quando o compartilhamento falha", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Falha ao compartilhar"));
    vi.stubGlobal("navigator", { canShare: vi.fn().mockReturnValue(true), share });

    await expect(shareStockPdf(pdf)).rejects.toThrow("Falha ao compartilhar");
    expect(share).toHaveBeenCalledTimes(1);
  });
});
