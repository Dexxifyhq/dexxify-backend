import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KycVerification,
  KycType,
  KycStatus,
  LedgerEntry,
  TxType,
} from '../../database/entities';
import {
  VerifyBvnDto,
  VerifyNinDto,
  VerifyDocumentDto,
  LivenessCheckDto,
} from './dto';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly BVN_FEE = 150;
  private readonly NIN_FEE = 150;
  private readonly DOCUMENT_FEE = 500;
  private readonly LIVENESS_FEE = 400;

  private readonly koraSecretKey: string;
  private readonly koraEncryptionKey: string;

  constructor(
    @InjectRepository(KycVerification)
    private readonly kycRepo: Repository<KycVerification>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly config: ConfigService,
  ) {
    const isProduction =
      this.config.get<string>('app.nodeEnv') === 'production';
    this.koraSecretKey = isProduction
      ? this.config.get<string>('kora.secretKey') || ''
      : this.config.get<string>('kora.testSecretKey') || '';
    this.koraEncryptionKey = isProduction
      ? this.config.get<string>('kora.encryptionKey') || ''
      : this.config.get<string>('kora.testEncryptionKey') || '';
  }

  async verifyBvn(developerId: string, dto: VerifyBvnDto) {
    return this.executeVerification(developerId, {
      type: KycType.BVN,
      external_user_id: dto.external_user_id,
      id_number: dto.bvn,
      first_name: dto.first_name,
      last_name: dto.last_name,
      date_of_birth: dto.date_of_birth,
      fee: this.BVN_FEE,
    });
  }

  async verifyNin(developerId: string, dto: VerifyNinDto) {
    return this.executeVerification(developerId, {
      type: KycType.NIN,
      external_user_id: dto.external_user_id,
      id_number: dto.nin,
      first_name: dto.first_name,
      last_name: dto.last_name,
      fee: this.NIN_FEE,
    });
  }

  async verifyDocument(developerId: string, dto: VerifyDocumentDto) {
    return this.executeVerification(developerId, {
      type: KycType.DOCUMENT,
      external_user_id: dto.external_user_id,
      document_url: dto.document_url,
      first_name: dto.first_name,
      last_name: dto.last_name,
      fee: this.DOCUMENT_FEE,
    });
  }

  async livenessCheck(developerId: string, dto: LivenessCheckDto) {
    return this.executeVerification(developerId, {
      type: KycType.LIVENESS,
      external_user_id: dto.external_user_id,
      selfie_url: dto.selfie_url,
      document_url: dto.document_url,
      fee: this.LIVENESS_FEE,
    });
  }

  async getStatus(developerId: string, externalUserId: string) {
    const verifications = await this.kycRepo.find({
      where: { developer_id: developerId, external_user_id: externalUserId },
      order: { created_at: 'DESC' },
    });

    if (!verifications.length) {
      throw new NotFoundException('No KYC records found for this user.');
    }

    const allVerified = verifications.every(
      (v) => v.status === KycStatus.VERIFIED,
    );
    const anyFailed = verifications.some((v) => v.status === KycStatus.FAILED);
    const anyPending = verifications.some(
      (v) => v.status === KycStatus.PENDING,
    );

    return {
      external_user_id: externalUserId,
      overall_status: allVerified
        ? 'verified'
        : anyFailed
          ? 'failed'
          : anyPending
            ? 'pending'
            : 'incomplete',
      verifications: verifications.map((v) => ({
        id: v.id,
        type: v.type,
        status: v.status,
        confidence_score: v.confidence_score,
        verified_at: v.verified_at,
        created_at: v.created_at,
      })),
    };
  }

  // ── Core verification executor ───────────────────────────

  private async executeVerification(
    developerId: string,
    params: {
      type: KycType;
      external_user_id: string;
      id_number?: string;
      document_url?: string;
      selfie_url?: string;
      first_name?: string;
      last_name?: string;
      date_of_birth?: string;
      fee: number;
    },
  ) {
    const koraResult = await this.callKoraKyc(params);

    const verification = this.kycRepo.create({
      developer_id: developerId,
      external_user_id: params.external_user_id,
      type: params.type,
      status: koraResult.status as KycStatus,
      id_number: params.id_number,
      document_url: params.document_url,
      selfie_url: params.selfie_url,
      first_name: params.first_name,
      last_name: params.last_name,
      date_of_birth: params.date_of_birth
        ? new Date(params.date_of_birth)
        : undefined,
      provider_reference: koraResult.reference,
      provider_response: koraResult.raw,
      confidence_score: koraResult.confidence,
      verified_at: koraResult.status === 'verified' ? new Date() : undefined,
    });

    const saved = await this.kycRepo.save(verification);

    // Record fee
    // await this.ledgerRepo.save(
    //   this.ledgerRepo.create({
    //     developer_id: developerId,
    //     tx_type: TxType.FEE,
    //     reference_type: 'kyc',
    //     reference_id: saved.id,
    //     debit: params.fee,
    //     credit: 0,
    //     asset: 'NGN',
    //     description: `KYC ${params.type} verification fee`,
    //   }),
    // );

    return saved;
  }

  // ── Kora KYC stub ────────────────────────────────────────

  private async callKoraKyc(params: any): Promise<{
    status: string;
    reference: string;
    confidence: number;
    raw: any;
  }> {
    // TODO: Replace with actual Kora Identity API calls
    // BVN: POST https://api.korapay.com/merchant/api/v1/identity/bvn
    // NIN: POST https://api.korapay.com/merchant/api/v1/identity/nin
    // Headers: { Authorization: `Bearer ${this.koraSecretKey}` }
    //
    // Example request body for BVN:
    // { bvn: "12345678901", first_name: "John", last_name: "Doe" }
    //
    // Use this.koraEncryptionKey if Kora requires payload encryption

    this.logger.warn('Using stub Kora KYC — implement actual API call');
    return {
      status: 'verified',
      reference: `kora_${Date.now()}`,
      confidence: 99.5,
      raw: { stub: true, type: params.type, provider: 'kora' },
    };
  }
}
