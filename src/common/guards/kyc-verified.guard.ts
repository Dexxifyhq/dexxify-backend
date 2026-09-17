import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../../database/entities';
import { KycService } from '../../modules/kyc/kyc.service';

interface RequestWithUser extends Request {
  user?: User;
}

/**
 * Blocks fund-moving actions (deposits, withdrawals, swaps) unless the
 * authenticated user has a fully verified individual KYC status.
 */
@Injectable()
export class KycVerifiedGuard implements CanActivate {
  constructor(private readonly kycService: KycService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Authentication required.');
    }

    const { overall_status } =
      await this.kycService.getIndividualStatus(userId);

    if (overall_status !== 'verified') {
      throw new ForbiddenException(
        'This action requires a verified identity. Complete individual KYC verification first.',
      );
    }

    return true;
  }
}
