import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Business,
  BusinessUser,
  BusinessRole,
  BusinessUserStatus,
  User,
  SettlementCurrency,
  PayoutMethod,
} from '../../database/entities';
import {
  CreateBusinessDto,
  UpdateBusinessProfileDto,
  UpdateSettlementsDto,
  UpdateNotificationsDto,
} from './dto';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(BusinessUser)
    private readonly businessUserRepo: Repository<BusinessUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(userId: string, dto: CreateBusinessDto): Promise<Business> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const name = dto.name?.trim() || `${user.first_name}'s Business`;

    const business = await this.businessRepo.save(
      this.businessRepo.create({
        owner_user_id: userId,
        name,
        type: dto.type ?? null,
        settlement_currency: SettlementCurrency.USDT,
        default_payout_method: PayoutMethod.CRYPTO,
        notification_preferences: {
          email_notifications: true,
          low_balance_alerts: false,
          automated_receipts: true,
          invoice_followups: true,
        },
      }),
    );

    await this.businessUserRepo.save(
      this.businessUserRepo.create({
        user_id: userId,
        business_id: business.id,
        role: BusinessRole.OWNER,
        status: BusinessUserStatus.ACTIVE,
        joined_at: new Date(),
      }),
    );

    return business;
  }

  async listForUser(
    userId: string,
  ): Promise<{ id: string; name: string; logo_url: string | null }[]> {
    const memberships = await this.businessUserRepo.find({
      where: { user_id: userId, status: BusinessUserStatus.ACTIVE },
      relations: ['business'],
      order: { joined_at: 'ASC' },
    });

    return memberships.map((m) => ({
      id: m.business.id,
      name: m.business.name,
      logo_url: m.business.logo_url,
    }));
  }

  async getById(businessId: string): Promise<Business> {
    const business = await this.businessRepo.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  async updateProfile(businessId: string, dto: UpdateBusinessProfileDto): Promise<Business> {
    await this.getById(businessId);

    const updates: Partial<Business> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.support_email !== undefined) updates.support_email = dto.support_email;
    if (dto.logo_url !== undefined) updates.logo_url = dto.logo_url;
    if (dto.show_branding_on_checkout !== undefined)
      updates.show_branding_on_checkout = dto.show_branding_on_checkout;
    if (dto.website_url !== undefined) updates.website_url = dto.website_url;

    await this.businessRepo.update(businessId, updates);
    return this.businessRepo.findOne({ where: { id: businessId } }) as Promise<Business>;
  }

  async updateSettlements(businessId: string, dto: UpdateSettlementsDto): Promise<Business> {
    await this.getById(businessId);

    const updates: Partial<Business> = {};
    if (dto.settlement_currency !== undefined)
      updates.settlement_currency = dto.settlement_currency;
    if (dto.default_payout_method !== undefined)
      updates.default_payout_method = dto.default_payout_method;
    if (dto.instant_payouts_enabled !== undefined)
      updates.instant_payouts_enabled = dto.instant_payouts_enabled;

    await this.businessRepo.update(businessId, updates);
    return this.businessRepo.findOne({ where: { id: businessId } }) as Promise<Business>;
  }

  async updateNotifications(businessId: string, dto: UpdateNotificationsDto): Promise<Business> {
    const business = await this.getById(businessId);

    if (dto.preferences !== undefined) {
      const merged = { ...business.notification_preferences, ...dto.preferences };
      await this.businessRepo.update(businessId, { notification_preferences: merged });
    }

    return this.businessRepo.findOne({ where: { id: businessId } }) as Promise<Business>;
  }
}
