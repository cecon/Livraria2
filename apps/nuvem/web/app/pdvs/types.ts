export type Machine = {
  uid: string;
  nome: string;
  ativo: boolean;
  usuarioUid: string;
  usuario: string;
  usuarioNome: string | null;
  cursorAplicado: string;
  cursorEntregue: string;
  cursorDisponivel: string;
  confirmadoEm: string | null;
  turnoStatus: string | null;
  turnoAbertura: string | null;
  turnoEncerramento: string | null;
  turnoOperador: string | null;
  vendasTurno: number;
  totalTurnoCentavos: string;
  caixaInicialCentavos: string;
  suprimentosCentavos: string;
  sangriasCentavos: string;
  esperadoCentavos: string | null;
  conferidoCentavos: string | null;
  diferencaCentavos: string | null;
};

export type MachineUser = {
  sync_uid: string;
  usuario: string;
  nome: string | null;
  ativo: boolean;
  excluido_em: string | null;
};

export type MachineCredential = { uid: string; refreshToken: string };
export type MachineInput = { nome: string; usuarioUid: string };
