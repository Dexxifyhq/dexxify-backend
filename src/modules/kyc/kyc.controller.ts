import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { KycService } from './kyc.service';
import {
  VerifyBvnDto,
  VerifyNinDto,
  VerifyDocumentDto,
  LivenessCheckDto,
} from './dto';
import { GetDeveloper } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('KYC Verification')
@ApiBearerAuth('api-key')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiOperation({
    summary: 'Verify BVN',
    description:
      'Verify Bank Verification Number (BVN) for identity validation',
  })
  @ApiBody({ type: VerifyBvnDto })
  @Post('bvn')
  async verifyBvn(
    @GetDeveloper('id') developerId: string,
    @Body() dto: VerifyBvnDto,
  ) {
    return this.kycService.verifyBvn(developerId, dto);
  }

  @ApiOperation({
    summary: 'Verify NIN',
    description:
      'Verify National Identification Number (NIN) for identity validation',
  })
  @ApiBody({ type: VerifyNinDto })
  @Post('nin')
  async verifyNin(
    @GetDeveloper('id') developerId: string,
    @Body() dto: VerifyNinDto,
  ) {
    return this.kycService.verifyNin(developerId, dto);
  }

  @ApiOperation({
    summary: 'Verify document',
    description:
      'Verify government-issued identity documents (passport, drivers license, etc.)',
  })
  @ApiBody({ type: VerifyDocumentDto })
  @Post('document')
  async verifyDocument(
    @GetDeveloper('id') developerId: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.kycService.verifyDocument(developerId, dto);
  }

  @ApiOperation({
    summary: 'Liveness check',
    description:
      'Perform biometric liveness check to verify user is physically present',
  })
  @ApiBody({ type: LivenessCheckDto })
  @Post('liveness')
  async livenessCheck(
    @GetDeveloper('id') developerId: string,
    @Body() dto: LivenessCheckDto,
  ) {
    return this.kycService.livenessCheck(developerId, dto);
  }

  @ApiOperation({
    summary: 'Get KYC status',
    description: 'Retrieve KYC verification status for a specific user',
  })
  @ApiParam({
    name: 'user_id',
    description: 'User unique identifier',
    example: 'user_123456',
  })
  @Get(':user_id/status')
  async getStatus(
    @GetDeveloper('id') developerId: string,
    @Param('user_id') userId: string,
  ) {
    return this.kycService.getStatus(developerId, userId);
  }
}
