import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: Record<string, unknown>): Promise<string> {
    const headers = request.headers as Record<string, string | string[] | undefined> | undefined;
    const authorization = headers?.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (value?.startsWith("Bearer ")) {
      return `session:${createHash("sha256").update(value.slice(7)).digest("hex")}`;
    }
    return super.getTracker(request);
  }
}
