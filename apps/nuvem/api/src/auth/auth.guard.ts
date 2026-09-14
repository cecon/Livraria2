import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthRequest } from "./principal";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException();
    request.principal = await this.auth.authenticate(header.slice(7));
    return true;
  }
}
