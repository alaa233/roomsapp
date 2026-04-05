import { Module } from '@nestjs/common';
import { SignalingService } from './signaling.service';

@Module({
  providers: [SignalingService],
})
export class SignalingModule {}
