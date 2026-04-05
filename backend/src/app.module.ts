import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { SignalingModule } from './signaling/signaling.module';

@Module({
  imports: [
    SignalingModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveStaticOptions: { index: false },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
