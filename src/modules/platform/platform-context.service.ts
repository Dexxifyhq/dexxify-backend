import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Business } from '../../database/entities';

@Injectable()
export class PlatformContextService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformContextService.name);
  private platformBusinessId: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email =
      this.config.get<string>('platform.email') || 'dexxifyhq@gmail.com';

    const platformUser = await this.userRepo.findOne({ where: { email } });

    if (platformUser) {
      const business = await this.businessRepo.findOne({
        where: { owner_user_id: platformUser.id },
        order: { created_at: 'ASC' },
      });
      this.platformBusinessId = business?.id ?? '';
    } else {
      this.platformBusinessId = '';
    }

    this.logger.log(`Platform business ID: ${this.platformBusinessId}`);
  }

  getBusinessId(): string {
    return this.platformBusinessId ?? '';
  }

  /** @deprecated Use getBusinessId() */
  getDeveloperId(): string {
    return this.getBusinessId();
  }
}
