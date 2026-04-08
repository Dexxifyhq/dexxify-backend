import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { KycService } from './kyc.service';
import {
  VerifyBvnDto,
  VerifyNinDto,
  VerifyDocumentDto,
  LivenessCheckDto,
} from './dto';
import { GetDeveloper } from '../../common/decorators';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('bvn')
  async verifyBvn(
    @GetDeveloper('id') developerId: string,
    @Body() dto: VerifyBvnDto,
  ) {
    return this.kycService.verifyBvn(developerId, dto);
  }

  @Post('nin')
  async verifyNin(
    @GetDeveloper('id') developerId: string,
    @Body() dto: VerifyNinDto,
  ) {
    return this.kycService.verifyNin(developerId, dto);
  }

  @Post('document')
  async verifyDocument(
    @GetDeveloper('id') developerId: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.kycService.verifyDocument(developerId, dto);
  }

  @Post('liveness')
  async livenessCheck(
    @GetDeveloper('id') developerId: string,
    @Body() dto: LivenessCheckDto,
  ) {
    return this.kycService.livenessCheck(developerId, dto);
  }

  @Get(':user_id/status')
  async getStatus(
    @GetDeveloper('id') developerId: string,
    @Param('user_id') userId: string,
  ) {
    return this.kycService.getStatus(developerId, userId);
  }
}
