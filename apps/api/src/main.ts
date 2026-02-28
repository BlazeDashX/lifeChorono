import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  console.log("CWD:", process.cwd());
console.log("HAS DATABASE_URL:", !!process.env.DATABASE_URL);
console.log("DATABASE_URL (start):", process.env.DATABASE_URL);
  app.enableCors({ 
    origin: ['http://localhost:3000'], 
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.listen(3003);
}

bootstrap();