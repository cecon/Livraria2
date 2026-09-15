export interface SaleV1 {
  pedidoUid: string;
  numero: number;
  cliente: string;
  turno: string;
  data: string;
  totalCentavos: number;
  operadorUid: string | null;
  turnoUid: string | null;
  numeroNoTurno: number | null;
  cancelado: boolean;
  itens: {
    uid: string; livroUid: string; codigo: string; titulo: string;
    precoCentavos: number; quantidade: number;
  }[];
  pagamentos: { uid: string; formaUid: string; valorCentavos: number }[];
}
