// Auto-update: verifica o GitHub Releases e instala sob confirmação do usuário.
// Em `npm run dev` (navegador) as APIs do Tauri não existem — falha silenciosa.

import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function verificarAtualizacao(
  aoEncontrar: (versao: string, instalar: () => Promise<void>) => void,
): Promise<void> {
  try {
    const update = await check();
    if (update) {
      const instalar = async () => {
        await update.downloadAndInstall();
        await relaunch();
      };
      aoEncontrar(update.version, instalar);
    }
  } catch {
    // sem runtime Tauri ou sem release publicada ainda — ignora
  }
}
