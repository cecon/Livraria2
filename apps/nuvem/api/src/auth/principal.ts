export interface Principal {
  uid: string;
  perfil: "admin" | "operador";
  tipo: "usuario" | "pdv";
  pdvUid?: string;
}

export interface AuthRequest {
  headers: Record<string, string | undefined>;
  principal: Principal;
}
