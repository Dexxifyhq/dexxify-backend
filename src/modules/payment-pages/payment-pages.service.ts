import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentPage,
  PaymentPageStatus,
  PaymentSession,
  PaymentSessionStatus,
  Customer,
} from '../../database/entities';
import {
  CoincircuitService,
  toCCAsset,
  toCCChain,
} from '../../providers/coincircuit/coincircuit.service';
import {
  parsePagination,
  buildPaginationMeta,
  generateSlug,
  generateUniqueId,
} from '../../common/utils';
import {
  CreatePaymentPageDto,
  UpdatePaymentPageDto,
  PaymentPageQueryDto,
  PublicPayDto,
} from './dto';

@Injectable()
export class PaymentPagesService {
  private readonly frontendUrl: string;
  private readonly webhookUrl: string;

  constructor(
    @InjectRepository(PaymentPage)
    private readonly pageRepo: Repository<PaymentPage>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
    private readonly cc: CoincircuitService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('frontend.url') || '';
    this.webhookUrl = this.config.get<string>('webhook.testUrl') || '';
    // this.webhookUrl = `${this.config.get<string>('app.apiPrefix') || ''}/webhooks/incoming/coincircuit`;
  }

  async create(developerId: string, dto: CreatePaymentPageDto) {
    if (!dto.amount) {
      throw new BadRequestException('amount is required.');
    }

    const slug = await this.resolveUniqueSlug(dto.slug || dto.title);

    const page = this.pageRepo.create({
      developer_id: developerId,
      title: dto.title,
      description: dto.description || null,
      slug,
      currency: dto.currency?.toUpperCase() || 'USD',
      amount: dto.amount ?? null,
      status: dto.status,
      // auto_settlement: dto.auto_settlement ?? false,
    });

    const saved = await this.pageRepo.save(page);
    return this.formatWithUrl(saved);
  }

  async findAll(developerId: string, query: PaymentPageQueryDto) {
    const { page, limit, offset } = parsePagination(query);

    const qb = this.pageRepo
      .createQueryBuilder('pp')
      .where('pp.developer_id = :developerId', { developerId });

    if (query.status)
      qb.andWhere('pp.status = :status', { status: query.status });

    qb.orderBy('pp.created_at', 'DESC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((p) => this.formatWithUrl(p)),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOne(developerId: string, pageId: string) {
    const page = await this.pageRepo.findOne({
      where: { id: pageId, developer_id: developerId },
    });
    if (!page) throw new NotFoundException('Payment page not found.');
    return this.formatWithUrl(page);
  }

  async update(developerId: string, pageId: string, dto: UpdatePaymentPageDto) {
    const page = await this.pageRepo.findOne({
      where: { id: pageId, developer_id: developerId },
    });
    if (!page) throw new NotFoundException('Payment page not found.');

    Object.assign(page, dto);
    const saved = await this.pageRepo.save(page);
    return this.formatWithUrl(saved);
  }

  async remove(developerId: string, pageId: string) {
    const page = await this.pageRepo.findOne({
      where: { id: pageId, developer_id: developerId },
    });
    if (!page) throw new NotFoundException('Payment page not found.');
    await this.pageRepo.remove(page);
    return { message: 'Payment page deleted.' };
  }

  async getSessions(
    developerId: string,
    pageId: string,
    query: PaymentPageQueryDto,
  ) {
    await this.findOne(developerId, pageId);

    const { page, limit, offset } = parsePagination(query);

    const [data, total] = await this.sessionRepo
      .createQueryBuilder('ps')
      .where('ps.payment_page_id = :pageId', { pageId })
      .orderBy('ps.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  // ── Public ────────────────────────────────────────────

  async getPublicPage(slug: string) {
    const page = await this.pageRepo.findOne({ where: { slug } });
    if (!page || page.status !== PaymentPageStatus.ACTIVE) {
      throw new NotFoundException(
        'Payment page not found or no longer active.',
      );
    }
    return this.toPublicView(page);
  }

  async pay(slug: string, dto: PublicPayDto) {
    const page = await this.pageRepo.findOne({ where: { slug } });

    if (!page || page.status !== PaymentPageStatus.ACTIVE) {
      throw new NotFoundException(
        'Payment page not found or no longer active.',
      );
    }

    // if (dto.amount !== undefined && dto.amount < Number(page.amount)) {
    //   throw new BadRequestException(
    //     `Minimum amount is ${page.amount} ${page.currency}.`,
    //   );
    // }

    // Map to CoincircuitMCP asset/chain identifiers (throws for unsupported)
    const ccAsset = toCCAsset(dto.asset);
    const ccChain = toCCChain(dto.network);
    // console.log(dto.asset);
    // console.log(dto.network);
    // console.log(ccAsset);
    // console.log(ccChain);

    // Find or create our local customer record
    const existingCustomer = await this.customerRepo.findOne({
      where: { email: dto.email, developer_id: page.developer_id },
    });

    const customer: Customer = existingCustomer
      ? existingCustomer
      : await this.customerRepo.save(
          this.customerRepo.create({
            developer_id: page.developer_id,
            first_name: dto.first_name,
            last_name: dto.last_name,
            email: dto.email,
          } as Customer),
        );

    // Create a CoincircuitMCP payment session — CC handles address provisioning
    const ccResult = await this.cc.createPaymentSession({
      title: page.title,
      description: page.description || page.title,
      amount: String(page.amount),
      currency: (page.currency as 'NGN' | 'USD') || 'NGN',
      asset: ccAsset,
      chain: ccChain,
      customer: {
        email: dto.email,
        firstName: dto.first_name,
        lastName: dto.last_name,
      },
      webhookUrl: this.webhookUrl || undefined,
    });

    const ccSession = ccResult.data;

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        developer_id: page.developer_id,
        customer_id: customer.id,
        payment_page_id: page.id,
        reference: `ps_${generateUniqueId().slice(0, 16)}`,
        provider_session_reference: ccSession.reference,
        deposit_address: ccSession.payment?.address ?? null,
        amount: page.amount,
        currency: page.currency,
        crypto_asset: dto.asset,
        network: dto.network,
        status: PaymentSessionStatus.PENDING,
        metadata: {
          ...(dto.metadata || {}),
          ...ccSession,
          payment_page_slug: slug,
        },
        expires_at: ccSession.expiresAt
          ? new Date(ccSession.expiresAt)
          : new Date(Date.now() + 30 * 60 * 1000),
      }),
    );

    return {
      session,
      // payment: ccSession.payment ?? null,
      // cancelUrl: ccSession.cancelUrl,
      // successUrl: ccSession.successUrl,
    };
  }

  // ── Helpers ───────────────────────────────────────────

  private async resolveUniqueSlug(base: string): Promise<string> {
    let slug = generateSlug(base);
    let attempts = 0;

    while (await this.pageRepo.findOne({ where: { slug } })) {
      if (++attempts > 5)
        throw new ConflictException(
          'Could not generate a unique slug. Try a different title.',
        );
      slug = generateSlug(base);
    }

    return slug;
  }

  private formatWithUrl(page: PaymentPage) {
    return {
      ...page,
      url: `${this.frontendUrl}/p/${page.slug}`,
    };
  }

  private toPublicView(page: PaymentPage) {
    return {
      title: page.title,
      description: page.description,
      slug: page.slug,
      currency: page.currency,
      amount: page.amount,
      status: page.status,
    };
  }
}
