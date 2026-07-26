import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';
import * as bcrypt from 'bcryptjs';
import { UpdateProfileDto, ChangePasswordDto } from './dto';

@Injectable()
export class DevelopersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'first_name',
        'last_name',
        'phone',
        'theme_preference',
        'subscription_plan',
        'status',
        'email_verified_at',
        'last_active_business_id',
        'created_at',
      ],
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updates: Partial<User> = {};
    if (dto.first_name !== undefined) updates.first_name = dto.first_name;
    if (dto.last_name !== undefined) updates.last_name = dto.last_name;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.theme_preference !== undefined)
      updates.theme_preference = dto.theme_preference;

    await this.userRepo.update(userId, updates);
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'password_hash'],
    });
    if (!user) throw new NotFoundException('User not found.');
    if (!user.password_hash) {
      throw new UnauthorizedException('No password set on this account.');
    }

    const valid = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');

    const newHash = await bcrypt.hash(dto.new_password, 12);
    await this.userRepo.update(userId, { password_hash: newHash });

    return { message: 'Password updated successfully.' };
  }
}
