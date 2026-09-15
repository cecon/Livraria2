import { invoke } from "@tauri-apps/api/core";

export interface MachineState {
  configured: boolean;
  nome: string | null;
  nomeSugerido: string;
}

export interface ConfigureMachineInput {
  nome: string;
  usuario: string;
  senha: string;
}

export function estadoMaquina(): Promise<MachineState> {
  return invoke<MachineState>("estado_maquina");
}

export function configurarMaquina(input: ConfigureMachineInput): Promise<MachineState> {
  return invoke<MachineState>("configurar_maquina", { input });
}
