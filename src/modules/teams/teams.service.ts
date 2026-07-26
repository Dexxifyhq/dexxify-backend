import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import {
  Business,
  User,
  UserStatus,
  BusinessUser,
  BusinessRole,
  BusinessUserStatus,
} from '../../database/entities';
import { InviteMemberDto, UpdateMemberDto, AcceptInviteDto } from './dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(BusinessUser)
    private readonly businessUserRepo: Repository<BusinessUser>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async invite(
    inviterUserId: string,
    businessId: string,
    dto: InviteMemberDto,
  ): Promise<Omit<BusinessUser, 'invite_token'>> {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found.');

    let invitee = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!invitee) {
      invitee = await this.userRepo.save(
        this.userRepo.create({
          email: dto.email,
          password_hash: null,
          first_name: '',
          last_name: '',
          status: UserStatus.PENDING,
        }),
      );
    }

    const existing = await this.businessUserRepo.findOne({
      where: { user_id: invitee.id, business_id: businessId },
    });

    if (existing && existing.status !== BusinessUserStatus.PENDING) {
      throw new ConflictException(
        'This user is already an active member of your workspace.',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let membership: BusinessUser;

    if (existing) {
      await this.businessUserRepo.update(existing.id, {
        role: dto.role,
        permissions: dto.permissions ?? [],
        invite_token: token,
        invite_expires_at: expiresAt,
        invited_by_user_id: inviterUserId,
      });
      membership = (await this.businessUserRepo.findOne({ where: { id: existing.id } }))!;
    } else {
      membership = await this.businessUserRepo.save(
        this.businessUserRepo.create({
          user_id: invitee.id,
          business_id: businessId,
          role: dto.role,
          permissions: dto.permissions ?? [],
          status: BusinessUserStatus.PENDING,
          invite_token: token,
          invite_expires_at: expiresAt,
          invited_by_user_id: inviterUserId,
        }),
      );
    }

    const inviter = await this.userRepo.findOne({
      where: { id: inviterUserId },
      select: ['first_name', 'last_name'],
    });

    const appUrl = this.config.get<string>('app.frontendUrl') || 'http://localhost:3000';
    const acceptUrl = `${appUrl}/accept-invite?token=${token}`;
    const inviterName = `${inviter?.first_name ?? ''} ${inviter?.last_name ?? ''}`.trim();

    this.mailService
      .sendTeamInviteEmail(dto.email, inviterName || 'Your team', business.name, dto.role, acceptUrl)
      .catch(() => {});

    const { invite_token, ...safe } = membership as any;
    return safe;
  }

  async listMembers(businessId: string) {
    const members = await this.businessUserRepo.find({
      where: { business_id: businessId, status: BusinessUserStatus.ACTIVE },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });

    return {
      data: members.map(({ invite_token, ...m }) => ({
        id: m.id,
        user_id: m.user_id,
        email: m.user?.email,
        first_name: m.user?.first_name,
        last_name: m.user?.last_name,
        role: m.role,
        status: m.status,
        permissions: m.permissions,
        joined_at: m.joined_at,
        created_at: m.created_at,
      })),
    };
  }

  async listInvitations(businessId: string) {
    const invitations = await this.businessUserRepo.find({
      where: { business_id: businessId, status: BusinessUserStatus.PENDING },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });

    return {
      data: invitations.map((m) => ({
        id: m.id,
        email: m.user?.email,
        role: m.role,
        permissions: m.permissions,
        invite_expires_at: m.invite_expires_at,
        created_at: m.created_at,
      })),
    };
  }

  async updateMember(businessId: string, memberId: string, dto: UpdateMemberDto) {
    const membership = await this.businessUserRepo.findOne({
      where: { id: memberId, business_id: businessId },
    });
    if (!membership) throw new NotFoundException('Team member not found.');

    const updates: Partial<BusinessUser> = {};
    if (dto.role !== undefined) updates.role = dto.role;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.permissions !== undefined) updates.permissions = dto.permissions;

    await this.businessUserRepo.update(memberId, updates);

    return this.businessUserRepo.findOne({
      where: { id: memberId },
      relations: ['user'],
    });
  }

  async removeMember(businessId: string, memberId: string) {
    const result = await this.businessUserRepo.delete({
      id: memberId,
      business_id: businessId,
    });

    if (result.affected === 0) throw new NotFoundException('Team member not found.');

    return { removed: true, id: memberId };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const membership = await this.businessUserRepo.findOne({
      where: { invite_token: dto.token },
    });

    if (!membership) throw new BadRequestException('Invalid invitation token.');

    if (membership.status !== BusinessUserStatus.PENDING) {
      throw new BadRequestException('This invitation has already been accepted.');
    }

    if (membership.invite_expires_at && new Date() > membership.invite_expires_at) {
      throw new BadRequestException(
        'This invitation has expired. Please ask the workspace owner to re-send it.',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: membership.user_id } });
    if (!user) throw new BadRequestException('Invitation user not found.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.userRepo.update(user.id, {
      first_name: dto.first_name,
      last_name: dto.last_name,
      password_hash: passwordHash,
      status: UserStatus.ACTIVE,
      email_verified_at: new Date(),
      last_active_business_id: membership.business_id,
    });

    await this.businessUserRepo.update(membership.id, {
      status: BusinessUserStatus.ACTIVE,
      joined_at: new Date(),
      invite_token: null,
      invite_expires_at: null,
    });

    return { message: 'Invitation accepted. You can now log in.' };
  }
}
