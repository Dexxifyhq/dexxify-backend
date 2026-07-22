import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../database/entities';
import { parsePagination, buildPaginationMeta } from '../../common/utils';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly cc: CoincircuitService,
  ) {}

  async create(developerId: string, dto: CreateCustomerDto) {
    const existing = await this.customerRepo.findOne({
      where: { developer_id: developerId, email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `Customer with email '${dto.email}' already exists.`,
      );
    }

    // Call CC first — if it fails, nothing is written to the DB
    const ccResult = await this.cc.syncCustomer({
      email: dto.email,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
      metadata: dto.metadata,
    });

    const customer = this.customerRepo.create({
      developer_id: developerId,
      email: dto.email,
      phone: dto.phone,
      first_name: dto.first_name,
      last_name: dto.last_name,
      cc_customer_id: ccResult.data?.id ?? null,
      metadata: dto.metadata || {},
    });

    return this.customerRepo.save(customer);
  }

  async findAll(developerId: string, query: CustomerQueryDto) {
    const { page, limit, offset } = parsePagination(query);

    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('c.developer_id = :developerId', { developerId })
      .addSelect(
        `(SELECT COUNT(*) FROM payment_sessions ps
        WHERE ps.customer_id = c.id AND ps.status = 'completed') > 0`,
        'c_has_paid',
      );

    if (query.status)
      qb.andWhere('c.status = :status', { status: query.status });

    qb.orderBy('c.created_at', 'DESC').skip(offset).take(limit);

    const result = await qb.getRawAndEntities();

    const data = result.raw.map((raw: any, i: number) => ({
      ...result.entities[i],
      has_paid:
        raw.c_has_paid === true ||
        raw.c_has_paid === 't' ||
        raw.c_has_paid === '1',
    }));

    return {
      data,
      meta: buildPaginationMeta(result.entities.length, page, limit),
    };
  }

  async findOne(developerId: string, customerId: string) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, developer_id: developerId },
    });
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }

  async update(
    developerId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ) {
    const customer = await this.findOne(developerId, customerId);
    Object.assign(customer, dto);
    const saved = await this.customerRepo.save(customer);

    // Sync update to CC if we have a CC customer ID
    if (saved.cc_customer_id) {
      try {
        await this.cc.updateCCCustomer(saved.cc_customer_id, {
          email: dto.email,
          firstName: dto.first_name,
          lastName: dto.last_name,
          phone: dto.phone,
        });
      } catch (err) {
        this.logger.warn(
          `CC customer update failed for ${saved.id}: ${err.message}`,
        );
      }
    }

    return saved;
  }

  async remove(developerId: string, customerId: string) {
    const customer = await this.findOne(developerId, customerId);
    await this.customerRepo.remove(customer);
    return { message: 'Customer deleted.' };
  }

  async getDepositAccount(developerId: string, customerId: string) {
    const customer = await this.findOne(developerId, customerId);

    if (!customer.cc_customer_id) {
      throw new BadRequestException(
        'Customer is not synced with payment provider.',
      );
    }

    try {
      const result = await this.cc.getCustomerDepositAccount(
        customer.cc_customer_id,
      );
      return result.data;
    } catch (err) {
      // Only fall through to create if CC says "not found"
      const status = err?.response?.status ?? err?.status;
      if (status !== 404) throw err;
    }

    const created = await this.cc.createDepositAccount(
      customer.cc_customer_id,
    );
    return created.data;
  }
}
