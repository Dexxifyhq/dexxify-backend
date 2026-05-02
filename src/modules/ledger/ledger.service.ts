import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { LedgerEntry } from '../../database/entities';
import { LedgerQueryDto } from './dto';
import { parsePagination, buildPaginationMeta } from '../../common/utils';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
  ) {}

  async findAll(developerId: string, query: LedgerQueryDto) {
    const { offset, limit, page } = parsePagination(query);

    const qb = this.ledgerRepo
      .createQueryBuilder('le')
      .where('le.developer_id = :developerId', { developerId })
      .orderBy('le.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.tx_type)
      qb.andWhere('le.tx_type = :txType', { txType: query.tx_type });
    if (query.currency)
      qb.andWhere('le.currency = :currency', { currency: query.currency });
    if (query.reference_type)
      qb.andWhere('le.reference_type = :refType', {
        refType: query.reference_type,
      });
    if (query.from_date)
      qb.andWhere('le.created_at >= :from', { from: query.from_date });
    if (query.to_date)
      qb.andWhere('le.created_at <= :to', { to: query.to_date });

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(developerId: string, txId: string) {
    const entry = await this.ledgerRepo.findOne({
      where: { id: txId, developer_id: developerId },
    });
    if (!entry) throw new NotFoundException('Transaction not found.');
    return entry;
  }

  async getBalance(developerId: string) {
    const entries = await this.ledgerRepo.find({
      where: { developer_id: developerId },
      select: ['asset', 'debit', 'credit'],
    });

    const balances: Record<
      string,
      { total_credit: number; total_debit: number; net: number }
    > = {};

    for (const entry of entries) {
      if (!balances[entry.asset]) {
        balances[entry.asset] = { total_credit: 0, total_debit: 0, net: 0 };
      }
      balances[entry.asset].total_credit += Number(entry.credit);
      balances[entry.asset].total_debit += Number(entry.debit);
      balances[entry.asset].net =
        balances[entry.asset].total_credit - balances[entry.asset].total_debit;
    }

    return { balances };
  }

  async getSettlementReport(developerId: string, query: { date?: string }) {
    const targetDate = query.date || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    const entries = await this.ledgerRepo.find({
      where: {
        developer_id: developerId,
        created_at: Between(startOfDay, endOfDay),
      },
      order: { created_at: 'ASC' },
    });

    const summary = {
      date: targetDate,
      total_entries: entries.length,
      total_debits: 0,
      total_credits: 0,
      by_type: {} as Record<
        string,
        { count: number; debit: number; credit: number }
      >,
    };

    for (const entry of entries) {
      summary.total_debits += Number(entry.debit);
      summary.total_credits += Number(entry.credit);

      if (!summary.by_type[entry.tx_type]) {
        summary.by_type[entry.tx_type] = { count: 0, debit: 0, credit: 0 };
      }
      summary.by_type[entry.tx_type].count++;
      summary.by_type[entry.tx_type].debit += Number(entry.debit);
      summary.by_type[entry.tx_type].credit += Number(entry.credit);
    }

    return { summary, entries };
  }
}
