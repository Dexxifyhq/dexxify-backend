import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSession, PaymentSessionStatus } from '../../database/entities';
import {
  parsePagination,
  buildPaginationMeta,
  generateUniqueId,
} from '../../common/utils';
import { CreatePaymentSessionDto, PaymentSessionQueryDto } from './dto';

@Injectable()
export class PaymentSessionsService {
  constructor(
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
  ) {}

  async create(developerId: string, dto: CreatePaymentSessionDto) {
    const expiresAt = dto.expires_in_minutes
      ? new Date(Date.now() + dto.expires_in_minutes * 60 * 1000)
      : new Date(Date.now() + 30 * 60 * 1000); // default 30 min

    const session = this.sessionRepo.create({
      developer_id: developerId,
      customer_id: dto.customer_id || null,
      reference: `ps_${generateUniqueId().slice(4, 12)}`,
      amount: dto.amount,
      crypto_asset: dto.crypto_asset || null,
      status: PaymentSessionStatus.PENDING,
      metadata: dto.metadata || {},
      expires_at: expiresAt,
    });

    return this.sessionRepo.save(session);
  }

  async findAll(developerId: string, query: PaymentSessionQueryDto) {
    const { page, limit, offset } = parsePagination(query);

    const qb = this.sessionRepo
      .createQueryBuilder('ps')
      .where('ps.developer_id = :developerId', { developerId });

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

  async findByReference(developerId: string, reference: string) {
    const session = await this.sessionRepo.findOne({
      where: { reference, developer_id: developerId },
      relations: ['customer'],
    });
    if (!session) throw new NotFoundException('Payment session not found.');
    return session;
  }

  async cancel(sessionId: string) {
    const session = await this.findOne(sessionId);

    if (session.status !== PaymentSessionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel a session with status '${session.status}'.`,
      );
    }

    session.status = PaymentSessionStatus.CANCELLED;
    return this.sessionRepo.save(session);
  }

  async markExpired(sessionId: string) {
    await this.sessionRepo.update(sessionId, {
      status: PaymentSessionStatus.EXPIRED,
    });
  }

  async linkTransaction(
    sessionId: string,
    transactionId: string,
    status: PaymentSessionStatus,
  ) {
    await this.sessionRepo.update(sessionId, {
      transaction_id: transactionId,
      status,
      completed_at:
        status === PaymentSessionStatus.COMPLETED ? new Date() : undefined,
    });
  }
}
