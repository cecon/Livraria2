import { Module } from "@nestjs/common";
import { PdvProductsController } from "./admin/pdv-products.controller";
import { PdvProductsService } from "./admin/pdv-products.service";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { AuthGuard } from "./auth/auth.guard";
import { DatabaseModule } from "./database/database.module";
import { DevicesController } from "./sync/devices.controller";
import { CatalogController } from "./sync/catalog.controller";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { SalesController } from "./sales/sales.controller";
import { SalesService } from "./sales/sales.service";
import { ShiftSyncController } from "./sync/shift-sync.controller";
import { ShiftSyncService } from "./sync/shift-sync.service";
import { CashSyncController } from "./sync/cash-sync.controller";
import { CashSyncService } from "./sync/cash-sync.service";
import { BooksController } from "./admin/books.controller";
import { BooksService } from "./admin/books.service";
import { FormsService } from "./admin/forms.service";
import { SuppliersService } from "./admin/suppliers.service";
import { FormsController, SuppliersController } from "./admin/references.controller";
import { UsersController } from "./admin/users.controller";
import { UsersService } from "./admin/users.service";
import { DestinationsService } from "./admin/destinations.service";
import { DestinationsController } from "./admin/destinations.controller";
import { StockController } from "./admin/stock.controller";
import { StockService } from "./admin/stock.service";
import { EntriesController } from "./admin/entries.controller";
import { EntriesService } from "./admin/entries.service";
import { ShiftsController } from "./admin/shifts.controller";
import { ShiftsService } from "./admin/shifts.service";
import { AdminSalesController } from "./admin/admin-sales.controller";
import { AdminSalesService } from "./admin/admin-sales.service";
import { ReportsController } from "./admin/reports.controller";
import { ReportsService } from "./admin/reports.service";
import { ApiThrottlerGuard } from "./auth/api-throttler.guard";
import { ShiftContextService } from "./auth/shift-context.service";
import { LlmService } from "./llm/llm.service";
import { LlmAdminController, LlmUsageController } from "./llm/llm.controller";

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 600 }]),
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
  controllers: [PdvProductsController, AuthController, DevicesController, CatalogController, SalesController, ShiftSyncController, CashSyncController, BooksController,
    FormsController, SuppliersController, UsersController, DestinationsController, StockController,
    EntriesController, ShiftsController, AdminSalesController, ReportsController, LlmAdminController, LlmUsageController],
  providers: [PdvProductsService, AuthService, AuthGuard, SalesService, ShiftSyncService, CashSyncService, BooksService, FormsService, SuppliersService,
    UsersService, DestinationsService, StockService, EntriesService, ShiftsService, AdminSalesService,
    ReportsService, LlmService, ShiftContextService,
    { provide: APP_GUARD, useClass: ApiThrottlerGuard }],
})
export class OperationsModule {}
