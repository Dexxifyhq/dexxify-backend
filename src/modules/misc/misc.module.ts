import { Module } from '@nestjs/common';
import { MiscController, HealthController } from './misc.controller';
import { MiscService } from './misc.service';

@Module({
  controllers: [MiscController, HealthController],
  providers: [MiscService],
  exports: [MiscService],
})
export class MiscModule {}
