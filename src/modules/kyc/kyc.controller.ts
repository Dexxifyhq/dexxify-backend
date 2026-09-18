import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { KycService } from './kyc.service';
import { VerifyBvnDto, VerifyNinDto, VerifyVninDto, VerifyCacDto } from './dto';
import { DualAuth, GetBusinessId, GetUser } from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';

@ApiTags('KYC Verification')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  // ── Individual KYC (user-scoped) ─────────────────────────

  @ApiOperation({
    summary: 'Verify BVN',
    description:
      'Submit a BVN for identity verification. One per user across all businesses.',
  })
  @ApiBody({ type: VerifyBvnDto })
  @ApiCreatedResponse({
    description: 'BVN verification submitted successfully.',
  })
  @ApiErrorResponses(400, 401, 404, 409)
  @Post('bvn')
  async verifyBvn(@GetUser('id') userId: string, @Body() dto: VerifyBvnDto) {
    return this.kycService.verifyBvn(userId, dto);
  }

  @ApiOperation({
    summary: 'Verify NIN',
    description:
      'Submit a NIN for identity verification. One per user across all businesses.',
  })
  @ApiBody({ type: VerifyNinDto })
  @ApiCreatedResponse({
    description: 'NIN verification submitted successfully.',
  })
  @ApiErrorResponses(400, 401, 404, 409)
  @Post('nin')
  async verifyNin(@GetUser('id') userId: string, @Body() dto: VerifyNinDto) {
    return this.kycService.verifyNin(userId, dto);
  }

  @ApiOperation({
    summary: 'Verify virtual NIN (vNIN)',
    description:
      'Submit a vNIN for identity verification. One per user across all businesses.',
  })
  @ApiBody({ type: VerifyVninDto })
  @ApiCreatedResponse({
    description: 'vNIN verification submitted successfully.',
  })
  @ApiErrorResponses(400, 401, 404, 409)
  @Post('vnin')
  async verifyVnin(@GetUser('id') userId: string, @Body() dto: VerifyVninDto) {
    return this.kycService.verifyVnin(userId, dto);
  }

  // ── Business KYC (business-scoped) ───────────────────────

  @ApiOperation({
    summary: 'Verify CAC',
    description:
      'Submit a CAC RC number for business verification. One per business.',
  })
  @ApiBody({ type: VerifyCacDto })
  @ApiCreatedResponse({
    description: 'CAC verification submitted successfully.',
  })
  @ApiErrorResponses(400, 401, 404, 409)
  @Post('cac')
  async verifyCac(
    @GetBusinessId() businessId: string,
    @Body() dto: VerifyCacDto,
  ) {
    return this.kycService.verifyCac(businessId, dto);
  }

  // ── Status queries ────────────────────────────────────────

  @ApiOperation({
    summary: 'Get individual KYC status',
    description:
      'Returns all identity verifications (BVN/NIN/vNIN) for the current user.',
  })
  @ApiOkResponse({
    description: 'Individual KYC status retrieved successfully.',
  })
  @ApiErrorResponses(401)
  @ApiExcludeEndpoint()
  @Get('individual/status')
  async getIndividualStatus(@GetUser('id') userId: string) {
    return this.kycService.getIndividualStatus(userId);
  }

  @ApiOperation({
    summary: 'Get business KYC status',
    description: 'Returns CAC verification status for the active business.',
  })
  @ApiOkResponse({ description: 'Business KYC status retrieved successfully.' })
  @ApiErrorResponses(401)
  @ApiExcludeEndpoint()
  @Get('business/status')
  async getBusinessStatus(@GetBusinessId() businessId: string) {
    return this.kycService.getBusinessStatus(businessId);
  }

  @ApiOperation({
    summary: 'Get verification by reference',
    description:
      'Proxy to Kora, fetches a verification record by its provider reference.',
  })
  @ApiParam({ name: 'reference', description: 'Kora provider reference ID' })
  @ApiOkResponse({ description: 'Verification record retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  @Get('verifications/:reference')
  async getVerification(@Param('reference') reference: string) {
    return this.kycService.getVerificationByReference(reference);
  }
}
