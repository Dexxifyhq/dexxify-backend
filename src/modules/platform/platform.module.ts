import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Business } from '../../database/entities';
import { PlatformContextService } from './platform-context.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, Business])],
  providers: [PlatformContextService],
  exports: [PlatformContextService],
})
export class PlatformModule {}
