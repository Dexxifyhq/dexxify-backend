import { Injectable } from '@nestjs/common';
import { CoincircuitService } from '../../providers/coincircuit/coincircuit.service';
import { RefundDto, RefundQueryDto, EstimateRefundQueryDto } from './dto';

@Injectable()
export class RefundsService {
  constructor(private readonly cc: CoincircuitService) {}

  refundSession(mode: 'live' | 'test', sessionReference: string, dto: RefundDto) {
    return this.cc.refundSession(mode, sessionReference, dto);
  }

  estimateRefund(mode: 'live' | 'test', reference: string, query: EstimateRefundQueryDto) {
    return this.cc.estimateRefund(mode, reference, query.entity, query.feePaidBy);
  }

  findAll(mode: 'live' | 'test', query: RefundQueryDto) {
    const params: Record<string, string> = {};
    if (query.page) params.page = String(query.page);
    if (query.size) params.size = String(query.size);
    if (query.status) params.status = query.status;
    if (query.sessionReference)
      params.sessionReference = query.sessionReference;
    if (query.invoiceReference)
      params.invoiceReference = query.invoiceReference;
    if (query.startDate) params.startDate = query.startDate;
    if (query.endDate) params.endDate = query.endDate;
    if (query.search) params.search = query.search;
    return this.cc.listRefunds(mode, params);
  }

  findOne(mode: 'live' | 'test', id: string) {
    return this.cc.getRefund(mode, id);
  }
}
