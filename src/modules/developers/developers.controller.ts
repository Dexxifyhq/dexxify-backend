import { Controller, Get, Patch, Post, Body } from '@nestjs/common';
import { DevelopersService } from './developers.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto';
import { DualAuth, GetUser } from '../../common/decorators';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Developers/Merchants')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('developers')
export class DevelopersController {
  constructor(private readonly developersService: DevelopersService) {}

  @ApiOperation({ summary: 'Get current developer profile' })
  @Get('me')
  async getProfile(@GetUser('id') userId: string) {
    return this.developersService.getProfile(userId);
  }

  @ApiOperation({ summary: 'Update personal profile (name, phone, theme)' })
  @ApiBody({ type: UpdateProfileDto })
  @Patch('me')
  async updateProfile(
    @GetUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.developersService.updateProfile(userId, dto);
  }

  @ApiOperation({ summary: 'Change password' })
  @ApiBody({ type: ChangePasswordDto })
  @Post('me/change-password')
  async changePassword(
    @GetUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.developersService.changePassword(userId, dto);
  }
}
