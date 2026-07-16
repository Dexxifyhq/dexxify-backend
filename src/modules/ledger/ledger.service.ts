import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LedgerEntry, LedgerEntryStatus } from '../../database/entities';
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
    const result = await this.ledgerRepo
      .createQueryBuilder('le')
      .select('SUM(le.credit_ngn)', 'totalCreditNgn')
      .addSelect('SUM(le.debit_ngn)', 'totalDebitNgn')
      .addSelect('SUM(le.credit_usd)', 'totalCreditUsd')
      .addSelect('SUM(le.debit_usd)', 'totalDebitUsd')
      .where('le.developer_id = :developerId', { developerId })
      .andWhere('le.status IN (:...statuses)', {
        statuses: [
          LedgerEntryStatus.COMPLETED,
          LedgerEntryStatus.REVERSED,
          LedgerEntryStatus.REJECTED,
        ],
      })
      .getRawOne();

    const creditNgn = Number(result?.totalCreditNgn ?? 0);
    const debitNgn = Number(result?.totalDebitNgn ?? 0);
    const creditUsd = Number(result?.totalCreditUsd ?? 0);
    const debitUsd = Number(result?.totalDebitUsd ?? 0);

    return {
      ngn: {
        credits: creditNgn,
        debits: debitNgn,
        balance: creditNgn - debitNgn,
      },
      usd: {
        credits: creditUsd,
        debits: debitUsd,
        balance: creditUsd - debitUsd,
      },
      synced_at: new Date(),
    };
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
      total_debits_ngn: 0,
      total_credits_ngn: 0,
      total_debits_usd: 0,
      total_credits_usd: 0,
      by_type: {} as Record<
        string,
        { count: number; debit_ngn: number; credit_ngn: number; debit_usd: number; credit_usd: number }
      >,
    };

    for (const entry of entries) {
      summary.total_debits_ngn += Number(entry.debit_ngn);
      summary.total_credits_ngn += Number(entry.credit_ngn);
      summary.total_debits_usd += Number(entry.debit_usd);
      summary.total_credits_usd += Number(entry.credit_usd);

      if (!summary.by_type[entry.tx_type]) {
        summary.by_type[entry.tx_type] = {
          count: 0,
          debit_ngn: 0,
          credit_ngn: 0,
          debit_usd: 0,
          credit_usd: 0,
        };
      }
      summary.by_type[entry.tx_type].count++;
      summary.by_type[entry.tx_type].debit_ngn += Number(entry.debit_ngn);
      summary.by_type[entry.tx_type].credit_ngn += Number(entry.credit_ngn);
      summary.by_type[entry.tx_type].debit_usd += Number(entry.debit_usd);
      summary.by_type[entry.tx_type].credit_usd += Number(entry.credit_usd);
    }

    return { summary, entries };
  }
}
