import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycVerification, KycType, KycStatus } from '../../database/entities';
import {
  VerifyBvnDto,
  VerifyNinDto,
  VerifyVninDto,
  VerifyCacDto,
  KycValidationDto,
} from './dto';

const KORA_BASE = 'https://api.korapay.com/merchant/api/v1';

export interface KoraValidationResult {
  [field: string]: { value: string; match: boolean };
}

export interface KoraIdentityData {
  reference?: string;
  status?: string;
  validation?: KoraValidationResult;
  image?: string;
  signature?: string;
  [key: string]: unknown;
}

export interface KoraApiResponse {
  status?: boolean;
  message?: string;
  data?: KoraIdentityData | null;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly secretKey: string;

  constructor(
    @InjectRepository(KycVerification)
    private readonly kycRepo: Repository<KycVerification>,
    private readonly config: ConfigService,
  ) {
    const isProd = this.config.get<string>('app.nodeEnv') === 'production';
    this.secretKey = isProd
      ? this.config.get<string>('kora.secretKey') || ''
      : this.config.get<string>('kora.testSecretKey') || '';
  }

  // ── Individual KYC (user-scoped) ─────────────────────────

  async verifyBvn(userId: string, dto: VerifyBvnDto) {
    await this.assertNoExistingVerification(userId, KycType.BVN);

    const koraPayload = {
      id: dto.bvn,
      verification_consent: true,
      ...(dto.validation && { validation: dto.validation }),
    };

    const result = await this.callKora(
      `${KORA_BASE}/identities/ng/bvn`,
      koraPayload,
    );

    return this.saveIndividualVerification(userId, {
      type: KycType.BVN,
      id_number: dto.bvn,
      validation_input: dto.validation ?? null,
      result,
    });
  }

  async verifyNin(userId: string, dto: VerifyNinDto) {
    await this.assertNoExistingVerification(userId, KycType.NIN);

    const koraPayload = {
      id: dto.nin,
      verification_consent: true,
      ...(dto.validation && { validation: dto.validation }),
    };

    const result = await this.callKora(
      `${KORA_BASE}/identities/ng/nin`,
      koraPayload,
    );

    return this.saveIndividualVerification(userId, {
      type: KycType.NIN,
      id_number: dto.nin,
      validation_input: dto.validation ?? null,
      result,
    });
  }

  async verifyVnin(userId: string, dto: VerifyVninDto) {
    await this.assertNoExistingVerification(userId, KycType.VNIN);

    const koraPayload = {
      id: dto.vnin,
      verification_consent: true,
      ...(dto.validation && { validation: dto.validation }),
    };

    const result = await this.callKora(
      `${KORA_BASE}/identities/ng/vnin`,
      koraPayload,
    );

    return this.saveIndividualVerification(userId, {
      type: KycType.VNIN,
      id_number: dto.vnin,
      validation_input: dto.validation ?? null,
      result,
    });
  }

  // ── Business KYC (business-scoped) ───────────────────────

  async verifyCac(businessId: string, dto: VerifyCacDto) {
    const existing = await this.kycRepo.findOne({
      where: { business_id: businessId, type: KycType.CAC },
    });
    if (existing) {
      throw new ConflictException(
        'A CAC verification already exists for this business.',
      );
    }

    const koraPayload = {
      id: dto.rc_number,
      registration_type: dto.registration_type,
      verification_consent: true,
      ...(dto.registration_name && {
        registration_name: dto.registration_name,
      }),
    };

    const result = await this.callKora(
      `${KORA_BASE}/identities/ng/cac`,
      koraPayload,
    );

    const verification = await this.kycRepo.save(
      this.kycRepo.create({
        business_id: businessId,
        user_id: null,
        type: KycType.CAC,
        status: result.data ? KycStatus.VERIFIED : KycStatus.FAILED,
        id_number: dto.rc_number,
        validation_input: {
          registration_type: dto.registration_type,
          ...(dto.registration_name && {
            registration_name: dto.registration_name,
          }),
        },
        validation_result: null,
        provider_reference: result.data?.reference ?? null,
        provider_response: result.data ?? {},
      }),
    );

    return {
      id: verification.id,
      status: verification.status,
      message: result.message,
      data: result.data,
    };
  }

  // ── Status queries ────────────────────────────────────────

  async getIndividualStatus(userId: string) {
    const verifications = await this.kycRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      select: [
        'id',
        'type',
        'status',
        'provider_reference',
        'created_at',
        'updated_at',
      ],
    });

    return {
      overall_status: this.computeOverallStatus(verifications),
      verifications,
    };
  }

  async getBusinessStatus(businessId: string) {
    const verification = await this.kycRepo.findOne({
      where: { business_id: businessId, type: KycType.CAC },
      select: [
        'id',
        'type',
        'status',
        'validation_input',
        'provider_reference',
        'created_at',
        'updated_at',
      ],
    });

    return {
      verified: verification?.status === KycStatus.VERIFIED,
      verification: verification ?? null,
    };
  }

  async getVerificationByReference(
    reference: string,
  ): Promise<KoraApiResponse> {
    const response = await fetch(
      `${KORA_BASE}/identities/verifications/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const result = (await response.json()) as KoraApiResponse;
    if (!response.ok) {
      throw new NotFoundException(result.message || 'Verification not found.');
    }

    return result;
  }

  // ── Helpers ───────────────────────────────────────────────

  private async assertNoExistingVerification(userId: string, type: KycType) {
    const existing = await this.kycRepo.findOne({
      where: { user_id: userId, type },
    });
    if (existing) {
      throw new ConflictException(
        `A ${type.toUpperCase()} verification already exists for this user.`,
      );
    }
  }

  private async saveIndividualVerification(
    userId: string,
    params: {
      type: KycType;
      id_number: string;
      validation_input: KycValidationDto | null;
      result: { message: string; data: KoraIdentityData | null };
    },
  ) {
    const { data } = params.result;
    const { image, signature, ...safeData } = data ?? {};
    void image;
    void signature;

    const verification = await this.kycRepo.save(
      this.kycRepo.create({
        user_id: userId,
        business_id: null,
        type: params.type,
        status: data ? KycStatus.VERIFIED : KycStatus.FAILED,
        id_number: params.id_number,
        validation_input: params.validation_input,
        validation_result: safeData?.validation ?? null,
        provider_reference: safeData?.reference ?? null,
        provider_response: safeData ?? {},
      }),
    );

    return {
      id: verification.id,
      status: verification.status,
      message: params.result.message,
      data: safeData,
    };
  }

  private async callKora(
    url: string,
    body: Record<string, any>,
  ): Promise<{ message: string; data: KoraIdentityData | null }> {
    if (!this.secretKey) {
      throw new BadRequestException('Kora API key not configured.');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as KoraApiResponse;

    if (!response.ok) {
      const msg: string = result?.message || 'Verification request failed.';
      if (msg.toLowerCase().includes('not found')) {
        throw new NotFoundException(msg);
      }
      throw new BadRequestException(msg);
    }

    return { message: result.message ?? '', data: result.data ?? null };
  }

  private computeOverallStatus(
    verifications: Pick<KycVerification, 'status'>[],
  ): 'verified' | 'failed' | 'pending' | 'incomplete' {
    if (!verifications.length) return 'incomplete';
    if (verifications.every((v) => v.status === KycStatus.VERIFIED))
      return 'verified';
    if (verifications.some((v) => v.status === KycStatus.FAILED))
      return 'failed';
    if (verifications.some((v) => v.status === KycStatus.PENDING))
      return 'pending';
    return 'incomplete';
  }
}
