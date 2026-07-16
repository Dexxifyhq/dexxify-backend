import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Developer } from '../../database/entities';
import { PlatformContextService } from './platform-context.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Developer])],
  providers: [PlatformContextService],
  exports: [PlatformContextService],
})
export class PlatformModule {}
