export interface Principal {
  uid: string;
  usuario: string;
  nome: string | null;
  perfil: "admin" | "operador";
  tipo: "usuario" | "pdv";
  pdvUid?: string;
}

export interface AuthRequest {
  headers: Record<string, string | undefined>;
  principal: Principal;
}
