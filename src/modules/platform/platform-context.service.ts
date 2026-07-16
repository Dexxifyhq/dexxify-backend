import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Developer, DeveloperStatus } from '../../database/entities';

@Injectable()
export class PlatformContextService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformContextService.name);
  private platformDeveloperId: string;

  constructor(
    @InjectRepository(Developer)
    private readonly devRepo: Repository<Developer>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email =
      this.config.get<string>('platform.email') || 'dexxifyhq@gmail.com';

    let platform = await this.devRepo.findOne({ where: { email } });

    // if (!platform) {
    //   platform = await this.devRepo.save(
    //     this.devRepo.create({
    //       email,
    //       password_hash: '',
    //       business_name: 'Dexxify Platform',
    //       first_name: 'Platform',
    //       last_name: 'Account',
    //       status: DeveloperStatus.ACTIVE,
    //     }),
    //   );
    //   this.logger.log(`Platform account seeded: ${platform.id}`);
    // }

    this.platformDeveloperId = platform?.id ?? '';
    this.logger.log(`Platform developer ID: ${this.platformDeveloperId}`);
  }

  getDeveloperId(): string {
    return this.platformDeveloperId ?? '';
  }
}
