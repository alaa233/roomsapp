import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
    next();
  });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}
bootstrap();
