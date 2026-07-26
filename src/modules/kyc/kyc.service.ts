import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
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

  async verifyBvn(businessId: string, dto: VerifyBvnDto) {
    const url = 'https://api.korapay.com/merchant/api/v1/identities/ng/bvn';
    return this.executeVerification(businessId, {
      type: KycType.BVN,
      id_number: dto.bvn,
      first_name: dto.first_name,
      last_name: dto.last_name,
      date_of_birth: dto.date_of_birth,
      kora_url: url,
    });
  }

  async verifyNin(businessId: string, dto: VerifyNinDto) {
    const url = 'https://api.korapay.com/merchant/api/v1/identities/ng/nin';

    return this.executeVerification(businessId, {
      type: KycType.NIN,
      id_number: dto.nin,
      first_name: dto.first_name,
      last_name: dto.last_name,
      kora_url: url,
    });
  }

  async verifyDocument(businessId: string, dto: VerifyDocumentDto) {
    const url = 'https://api.korapay.com/merchant/api/v1/identities/ng/cac';

    return this.executeVerification(businessId, {
      type: KycType.DOCUMENT,
      document_url: dto.document_url,
      first_name: dto.first_name,
      last_name: dto.last_name,
      kora_url: url,
    });
  }

  // async livenessCheck(businessId: string, dto: LivenessCheckDto) {
  //   return this.executeVerification(businessId, {
  //     type: KycType.LIVENESS,
  //     selfie_url: dto.selfie_url,
  //     document_url: dto.document_url,
  //     fee: this.LIVENESS_FEE,
  //   });
  // }

  async getStatus(businessId: string) {
    const verifications = await this.kycRepo.find({
      where: { business_id: businessId },
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
        created_at: v.created_at,
      })),
    };
  }

  // ── Core verification executor ───────────────────────────

  private async executeVerification(
    businessId: string,
    params: {
      type: KycType;
      id_number?: string;
      document_url?: string;
      selfie_url?: string;
      first_name?: string;
      last_name?: string;
      date_of_birth?: string;
      kora_url: string;
    },
  ) {
    const koraResult = await this.callKoraKyc(params);

    const verification = this.kycRepo.create({
      business_id: businessId,
      type: params.type,
      id_number: params.id_number,
      document_url: params.document_url,
      status: koraResult.status,
      selfie_url: params.selfie_url,
      first_name: params.first_name,
      last_name: params.last_name,
      date_of_birth: params.date_of_birth
        ? new Date(params.date_of_birth)
        : undefined,
      provider_reference: koraResult.data?.reference,
      provider_response: koraResult.data,
    });

    const saved = await this.kycRepo.save(verification);

    return {
      status: koraResult.status,
      message: koraResult.message,
      data: koraResult.data,
    };
  }

  // ── Kora KYC stub ────────────────────────────────────────

  private async callKoraKyc(params: any) {
    const { bvn, first_name, last_name, date_of_birth, kora_url } = params;

    try {
      // console.log(this.koraSecretKey);
      if (!this.koraSecretKey) {
        throw new Error('Kora configuration missing');
      }

      // Kora NIN verification API endpoint
      const response = await fetch(kora_url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.koraSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: bvn,
          verification_consent: true,
          validation: { first_name, last_name, date_of_birth },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new BadRequestException(result.message);
      }

      const { image, ...newResult } = result.data;

      return {
        status: result.status,
        message: result.message,
        data: newResult,
      };
    } catch (error) {
      if (error.message.includes('issue with your input')) {
        throw new BadRequestException(error.message);
      }
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message || 'Verification failed');
    }
  }
}
