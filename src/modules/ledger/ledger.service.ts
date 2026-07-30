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

  async findAll(businessId: string, mode: 'live' | 'test', query: LedgerQueryDto) {
    const { offset, limit, page } = parsePagination(query);

    const qb = this.ledgerRepo
      .createQueryBuilder('le')
      .where('le.business_id = :businessId', { businessId })
      .andWhere('le.mode = :mode', { mode })
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

  async findOne(businessId: string, mode: 'live' | 'test', txId: string) {
    const entry = await this.ledgerRepo.findOne({
      where: { id: txId, business_id: businessId, mode },
    });
    if (!entry) throw new NotFoundException('Transaction not found.');
    return entry;
  }

  async getBalance(businessId: string, mode: 'live' | 'test') {
    const result = await this.ledgerRepo
      .createQueryBuilder('le')
      .select('SUM(le.credit_ngn)', 'totalCreditNgn')
      .addSelect('SUM(le.debit_ngn)', 'totalDebitNgn')
      .addSelect('SUM(le.credit_usd)', 'totalCreditUsd')
      .addSelect('SUM(le.debit_usd)', 'totalDebitUsd')
      .addSelect('SUM(le.credit_usdt)', 'totalCreditUsdt')
      .addSelect('SUM(le.debit_usdt)', 'totalDebitUsdt')
      .addSelect('SUM(le.credit_usdc)', 'totalCreditUsdc')
      .addSelect('SUM(le.debit_usdc)', 'totalDebitUsdc')
      .where('le.business_id = :businessId', { businessId })
      .andWhere('le.mode = :mode', { mode })
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
    const creditUsdt = Number(result?.totalCreditUsdt ?? 0);
    const debitUsdt = Number(result?.totalDebitUsdt ?? 0);
    const creditUsdc = Number(result?.totalCreditUsdc ?? 0);
    const debitUsdc = Number(result?.totalDebitUsdc ?? 0);

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
      usdt: {
        credits: creditUsdt,
        debits: debitUsdt,
        balance: creditUsdt - debitUsdt,
      },
      usdc: {
        credits: creditUsdc,
        debits: debitUsdc,
        balance: creditUsdc - debitUsdc,
      },
      synced_at: new Date(),
    };
  }

  async getSettlementReport(businessId: string, mode: 'live' | 'test', query: { date?: string }) {
    const targetDate = query.date || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    const entries = await this.ledgerRepo.find({
      where: {
        business_id: businessId,
        mode,
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
      total_debits_usdt: 0,
      total_credits_usdt: 0,
      total_debits_usdc: 0,
      total_credits_usdc: 0,
      by_type: {} as Record<
        string,
        {
          count: number;
          debit_ngn: number;
          credit_ngn: number;
          debit_usd: number;
          credit_usd: number;
          debit_usdt: number;
          credit_usdt: number;
          debit_usdc: number;
          credit_usdc: number;
        }
      >,
    };

    for (const entry of entries) {
      summary.total_debits_ngn += Number(entry.debit_ngn);
      summary.total_credits_ngn += Number(entry.credit_ngn);
      summary.total_debits_usd += Number(entry.debit_usd);
      summary.total_credits_usd += Number(entry.credit_usd);
      summary.total_debits_usdt += Number(entry.debit_usdt);
      summary.total_credits_usdt += Number(entry.credit_usdt);
      summary.total_debits_usdc += Number(entry.debit_usdc);
      summary.total_credits_usdc += Number(entry.credit_usdc);

      if (!summary.by_type[entry.tx_type]) {
        summary.by_type[entry.tx_type] = {
          count: 0,
          debit_ngn: 0,
          credit_ngn: 0,
          debit_usd: 0,
          credit_usd: 0,
          debit_usdt: 0,
          credit_usdt: 0,
          debit_usdc: 0,
          credit_usdc: 0,
        };
      }
      summary.by_type[entry.tx_type].count++;
      summary.by_type[entry.tx_type].debit_ngn += Number(entry.debit_ngn);
      summary.by_type[entry.tx_type].credit_ngn += Number(entry.credit_ngn);
      summary.by_type[entry.tx_type].debit_usd += Number(entry.debit_usd);
      summary.by_type[entry.tx_type].credit_usd += Number(entry.credit_usd);
      summary.by_type[entry.tx_type].debit_usdt += Number(entry.debit_usdt);
      summary.by_type[entry.tx_type].credit_usdt += Number(entry.credit_usdt);
      summary.by_type[entry.tx_type].debit_usdc += Number(entry.debit_usdc);
      summary.by_type[entry.tx_type].credit_usdc += Number(entry.credit_usdc);
    }

    return { summary, entries };
  }
}
