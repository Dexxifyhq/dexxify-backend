import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentSession,
  PaymentSessionStatus,
  Customer,
} from '../../database/entities';
import {
  parsePagination,
  buildPaginationMeta,
  generateUniqueId,
} from '../../common/utils';
import {
  CreatePaymentSessionDto,
  GenerateDepositAddressDto,
  EstimatePaymentDto,
  PaymentSessionQueryDto,
} from './dto';
import {
  CoincircuitService,
  toCCAsset,
  toCCChain,
} from '../../providers/coincircuit/coincircuit.service';

@Injectable()
export class PaymentSessionsService {
  private readonly logger = new Logger(PaymentSessionsService.name);

  constructor(
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly cc: CoincircuitService,
  ) {}

  async create(businessId: string, mode: 'live' | 'test', dto: CreatePaymentSessionDto) {
    // Find or create our local customer record
    const existingCustomer = await this.customerRepo.findOne({
      where: { email: dto.customer_email, business_id: businessId, mode },
    });

    const customer: Customer = existingCustomer
      ? existingCustomer
      : await this.customerRepo.save(
          this.customerRepo.create({
            business_id: businessId,
            mode,
            first_name: dto.first_name,
            last_name: dto.last_name,
            email: dto.customer_email,
          } as Customer),
        );

    // Sync to CoincircuitMCP
    try {
      const ccPayload: Parameters<
        CoincircuitService['createPaymentSession']
      >[0] = {
        title: dto.title || 'Payment Session',
        description: dto.description || '',
        amount: String(dto.amount),
        currency: dto.currency as 'NGN' | 'USD',
        metadata: dto.metadata,
        successUrl: dto.success_url,
        cancelUrl: dto.cancel_url,
      };

      if (dto.crypto_asset) ccPayload.asset = toCCAsset(dto.crypto_asset);
      if (dto.network) ccPayload.chain = toCCChain(dto.network);
      if (customer?.email) {
        ccPayload.customer = {
          email: customer.email,
          firstName: customer.first_name || undefined,
          lastName: customer.last_name || undefined,
        };
      }

      const ccResult = await this.cc.createPaymentSession(ccPayload);
      const ccData = ccResult?.data;

      const session = this.sessionRepo.create({
        business_id: businessId,
        mode,
        customer_id: customer?.id || null,
        reference: `ps_${generateUniqueId().slice(4, 12)}`,
        amount: dto.amount,
        currency: dto.currency,
        crypto_asset: dto.crypto_asset || null,
        network: dto.network || null,
        status: PaymentSessionStatus.PENDING,
        metadata: dto.metadata || {},
        expires_at: ccData.expiresAt,
      });

      const saved = await this.sessionRepo.save(session);

      await this.sessionRepo.update(saved.id, {
        provider_session_reference: ccData?.reference ?? null,
        metadata: { ...saved.metadata, ...ccData },
      });

      // saved.provider_session_reference = ccData?.reference ?? null;
      // saved.metadata = {};
      return saved;
    } catch (err) {
      this.logger.warn(`Payment session creation failed, ${err.message}`);
      throw err;
    }
  }

  async findAll(businessId: string, mode: 'live' | 'test', query: PaymentSessionQueryDto) {
    const { page, limit, offset } = parsePagination(query);

    const qb = this.sessionRepo
      .createQueryBuilder('ps')
      .where('ps.business_id = :businessId', { businessId })
      .andWhere('ps.mode = :mode', { mode });

    if (query.status)
      qb.andWhere('ps.status = :status', { status: query.status });
    if (query.customer_id)
      qb.andWhere('ps.customer_id = :customer_id', {
        customer_id: query.customer_id,
      });

    qb.orderBy('ps.created_at', 'DESC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['customer'],
    });
    if (!session) throw new NotFoundException('Payment session not found.');
    return session;
  }

  async findByReference(businessId: string, reference: string) {
    const session = await this.sessionRepo.findOne({
      where: { reference, business_id: businessId },
      relations: ['customer'],
    });
    if (!session) throw new NotFoundException('Payment session not found.');

    // Enrich with live CC status if synced
    if (session.provider_session_reference) {
      try {
        const ccResult = await this.cc.getPaymentSession(
          session.provider_session_reference,
        );
        return { ...session, cc: ccResult?.data };
      } catch (err) {
        this.logger.warn(
          `CC session fetch failed for ${reference}: ${err.message}`,
        );
        throw err;
      }
    }

    return session;
  }

  async generateDepositAddress(
    sessionId: string,
    dto: GenerateDepositAddressDto,
  ) {
    const session = await this.findOne(sessionId);

    if (!session.provider_session_reference) {
      throw new BadRequestException(
        'Session is not yet synced with CoincircuitMCP.',
      );
    }

    if (
      session.status !== PaymentSessionStatus.PENDING
    ) {
      throw new BadRequestException(
        `Cannot generate address for session with status '${session.status}'.`,
      );
    }

    const asset = toCCAsset(dto.crypto_asset);
    const chain = toCCChain(dto.network);

    const ccResult = await this.cc.generateDepositAddress(
      session.provider_session_reference,
      asset,
      chain,
    );
    const address = ccResult?.data?.payment?.address ?? null;

    if (address) {
      await this.sessionRepo.update(session.id, {
        deposit_address: address,
        crypto_asset: dto.crypto_asset,
        network: dto.network,
      });
      session.deposit_address = address;
      session.crypto_asset = dto.crypto_asset;
      session.network = dto.network;
    }

    // return { session, cc: ccResult?.data };
    return { session };
  }

  async getEstimate(dto: EstimatePaymentDto) {
    const asset = toCCAsset(dto.crypto_asset);
    const chain = toCCChain(dto.network);
    const result = await this.cc.estimatePayment({
      asset,
      chain,
      amount: dto.amount,
      currency: dto.currency,
      reference: dto.reference,
    });

    if (dto.reference) {
      const session = await this.sessionRepo.findOne({
        where: { provider_session_reference: dto.reference },
      });
      if (!session) return;
      await this.sessionRepo.update(session.id, {
        metadata: { ...session.metadata, estimate: { ...result.data } },
      });
    }

    return result;
  }

  async cancel(sessionId: string) {
    const session = await this.findOne(sessionId);

    if (session.status !== PaymentSessionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel a session with status '${session.status}'.`,
      );
    }

    session.status = PaymentSessionStatus.FAILED;
    return this.sessionRepo.save(session);
  }

  async markExpired(sessionId: string) {
    await this.sessionRepo.update(sessionId, {
      status: PaymentSessionStatus.EXPIRED,
    });
  }

  // async linkTransaction(
  //   sessionId: string,
  //   transactionId: string,
  //   status: PaymentSessionStatus,
  // ) {
  //   await this.sessionRepo.update(sessionId, {
  //     transaction_id: transactionId,
  //     status,
  //     completed_at:
  //       status === PaymentSessionStatus.COMPLETED ? new Date() : undefined,
  //   });
  // }
}
