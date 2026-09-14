import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Controller("health")
class HealthController {
  @Get()
  health() {
    return { status: "ok", service: "nuvem-api", contractVersion: 1 };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT invalida");
  }
  await app.listen(port, process.env.HOST ?? "127.0.0.1");
}

void bootstrap();
