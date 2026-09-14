import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Principal } from "../auth/principal";

export function uuid(value: unknown): string {
  if (typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException("UUID invalido");
  }
  return value;
}

export function cursor(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(value) ||
    BigInt(value) > 9223372036854775807n) {
    throw new BadRequestException("Cursor invalido");
  }
  return BigInt(value);
}

export function admin(user: Principal) {
  if (user.tipo !== "usuario" || user.perfil !== "admin") throw new ForbiddenException();
}

export function device(user: Principal): string {
  if (user.tipo !== "pdv" || !user.pdvUid) throw new ForbiddenException();
  return user.pdvUid;
}
