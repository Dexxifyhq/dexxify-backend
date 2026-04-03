import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Developer, DeveloperStatus, ApiKey } from '../../database/entities';
import { RegisterDto, LoginDto } from './dto';
import { generateApiKey } from '../../common/utils';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Developer)
    private readonly developerRepo: Repository<Developer>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        'A developer account with this email already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const developer = this.developerRepo.create({
      email: dto.email,
      password_hash: passwordHash,
      business_name: dto.business_name,
      business_type: dto.business_type,
      contact_name: dto.contact_name,
      phone: dto.phone,
      status: DeveloperStatus.ACTIVE,
    });

    await this.developerRepo.save(developer);

    // Generate sandbox API key automatically
    const { key, prefix, hash } = generateApiKey('sandbox');

    const apiKeyEntity = this.apiKeyRepo.create({
      developer_id: developer.id,
      key_hash: hash,
      key_prefix: prefix,
      label: 'Default Sandbox Key',
      environment: 'sandbox',
    });
    await this.apiKeyRepo.save(apiKeyEntity);

    const tokens = this.generateTokens(developer.id, developer.email);

    return {
      developer: this.sanitizeDeveloper(developer),
      api_key: key, // Only shown once at registration
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const developer = await this.developerRepo.findOne({
      where: { email: dto.email },
    });

    if (!developer) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (developer.status !== DeveloperStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Account is suspended or pending activation.',
      );
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      developer.password_hash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = this.generateTokens(developer.id, developer.email);

    return {
      developer: this.sanitizeDeveloper(developer),
      ...tokens,
    };
  }

  async getProfile(developerId: string) {
    const developer = await this.developerRepo.findOne({
      where: { id: developerId },
    });

    if (!developer) {
      throw new UnauthorizedException('Developer not found.');
    }

    return this.sanitizeDeveloper(developer);
  }

  private generateTokens(developerId: string, email: string) {
    const payload = { sub: developerId, email };
    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
    };
  }

  private sanitizeDeveloper(developer: Developer) {
    const { password_hash, ...safe } = developer;
    return safe;
  }
}
