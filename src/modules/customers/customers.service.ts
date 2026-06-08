import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../database/entities';
import { parsePagination, buildPaginationMeta } from '../../common/utils';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
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

    const customer = this.customerRepo.create({
      developer_id: developerId,
      email: dto.email,
      phone: dto.phone,
      first_name: dto.first_name,
      last_name: dto.last_name,
      metadata: dto.metadata || {},
    });

    return this.customerRepo.save(customer);
  }

  async findAll(developerId: string, query: CustomerQueryDto) {
    const { page, limit, offset } = parsePagination(query);

    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('c.developer_id = :developerId', { developerId });

    if (query.status)
      qb.andWhere('c.status = :status', { status: query.status });

    qb.orderBy('c.created_at', 'DESC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
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
    return this.customerRepo.save(customer);
  }

  async remove(developerId: string, customerId: string) {
    const customer = await this.findOne(developerId, customerId);
    await this.customerRepo.remove(customer);
    return { message: 'Customer deleted.' };
  }
}
