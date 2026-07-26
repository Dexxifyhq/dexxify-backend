import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { KycService } from './kyc.service';
import {
  VerifyBvnDto,
  VerifyNinDto,
  VerifyDocumentDto,
  LivenessCheckDto,
} from './dto';
import { GetBusinessId, DualAuth } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('KYC Verification')
@ApiBearerAuth('api-key')
@DualAuth()
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
    @GetBusinessId() businessId: string,
    @Body() dto: VerifyBvnDto,
  ) {
    return this.kycService.verifyBvn(businessId, dto);
  }

  @ApiOperation({
    summary: 'Verify NIN',
    description:
      'Verify National Identification Number (NIN) for identity validation',
  })
  @ApiBody({ type: VerifyNinDto })
  @Post('nin')
  async verifyNin(
    @GetBusinessId() businessId: string,
    @Body() dto: VerifyNinDto,
  ) {
    return this.kycService.verifyNin(businessId, dto);
  }

  @ApiOperation({
    summary: 'Verify document',
    description:
      'Verify government-issued identity documents (passport, drivers license, CAC etc.)',
  })
  @ApiBody({ type: VerifyDocumentDto })
  @Post('document')
  async verifyDocument(
    @GetBusinessId() businessId: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.kycService.verifyDocument(businessId, dto);
  }

  // @ApiOperation({
  //   summary: 'Liveness check',
  //   description:
  //     'Perform biometric liveness check to verify user is physically present',
  // })
  // @ApiBody({ type: LivenessCheckDto })
  // @Post('liveness')
  // async livenessCheck(
  //   @GetBusinessId() businessId: string,
  //   @Body() dto: LivenessCheckDto,
  // ) {
  // return this.kycService.livenessCheck(businessId, dto);
  // }

  @ApiOperation({
    summary: 'Get KYC status',
    description: 'Retrieve KYC verification status for a specific user',
  })
  @Get('status')
  async getStatus(@GetBusinessId() businessId: string) {
    return this.kycService.getStatus(businessId);
  }
}
