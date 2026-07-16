import { Module } from '@nestjs/common';
import { CoincircuitService } from './coincircuit.service';

@Module({
  providers: [CoincircuitService],
  exports: [CoincircuitService],
})
export class CoincircuitModule {}
