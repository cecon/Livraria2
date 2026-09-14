import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { AuthGuard } from "./auth/auth.guard";
import { DatabaseModule } from "./database/database.module";
import { DevicesController } from "./sync/devices.controller";
import { CatalogController } from "./sync/catalog.controller";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { SalesController } from "./sales/sales.controller";
import { SalesService } from "./sales/sales.service";
import { BooksController } from "./admin/books.controller";
import { BooksService } from "./admin/books.service";

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.API_JWT_SECRET;
        if (!secret || Buffer.byteLength(secret) < 32 || !process.env.DATABASE_URL) {
          throw new Error("Configure DATABASE_URL e API_JWT_SECRET (minimo 32 bytes)");
        }
        return {
          secret,
          signOptions: { expiresIn: 900, issuer: "livraria-nuvem", audience: "livraria-api", algorithm: "HS256" },
          verifyOptions: { issuer: "livraria-nuvem", audience: "livraria-api", algorithms: ["HS256"] },
        };
      },
    }),
  ],
  controllers: [AuthController, DevicesController, CatalogController, SalesController, BooksController],
  providers: [AuthService, AuthGuard, SalesService, BooksService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class OperationsModule {}
