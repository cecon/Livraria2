import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

// Imported by business modules after database baseline validation.
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
