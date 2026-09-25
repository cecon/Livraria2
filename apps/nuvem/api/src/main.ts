import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { OperationsModule } from "./operations.module";

@Controller("health")
class HealthController {
  @Get()
  health() {
    return { status: "ok", service: "nuvem-api", contractVersion: 1 };
  }
}

@Module({
  controllers: [HealthController],
  imports: process.env.API_OPERATIONS_ENABLED === "true" ? [OperationsModule] : [],
})
class AppModule {}

function installLegacyPdvRoutes(app: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void }) {
  const rewrites: Array<[RegExp, string]> = [
    [/^\/api\/pdv\/catalogo(\/confirmacao)?(?=\?|$)/, "/api/v1/sync/catalogo$1"],
    [/^\/api\/pdv\/vendas(\/[0-9a-f-]+\/cancelamento)?(?=\?|$)/i, "/api/v1/sync/vendas$1"],
    [/^\/api\/pdv\/turnos(\/[0-9a-f-]+\/encerramento)?(?=\?|$)/i, "/api/v1/sync/turnos$1"],
    [/^\/api\/pdv\/caixa-movimentos(?=\?|$)/, "/api/v1/sync/caixa-movimentos"],
    [/^\/api\/pdv\/produtos\/codigo(?=\?|$)/, "/api/v1/produtos-pdv/codigo"],
    [/^\/api\/pdv\/produtos\/([0-9a-f-]+)(?=\?|$)/i, "/api/v1/produtos-pdv/$1"],
    [/^\/api\/pdv\/produtos(?=\?|$)/, "/api/v1/produtos-pdv"],
    [/^\/api\/pdv\/llms(\/[0-9a-f-]+\/testar)?(?=\?|$)/i, "/api/v1/llms$1"],
    [/^\/api\/pdv\/(configurar|renovar|produtos\/autorizacao)(?=\?|$)/, "/api/v1/pdv/$1"],
  ];
  app.use((req, _res, next) => {
    const url = req.url ?? "";
    for (const [from, to] of rewrites) {
      if (from.test(url)) {
        req.url = url.replace(from, to);
        break;
      }
    }
    next();
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  installLegacyPdvRoutes(app);
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT invalida");
  }
  await app.listen(port, process.env.HOST ?? "127.0.0.1");
}

void bootstrap();

