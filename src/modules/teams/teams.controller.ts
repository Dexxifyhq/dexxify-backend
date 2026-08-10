import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { InviteMemberDto, UpdateMemberDto, AcceptInviteDto } from './dto';
import {
  DualAuth,
  GetBusinessId,
  GetUser,
  Public,
} from '../../common/decorators';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Teams')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @ApiOperation({ summary: 'Invite a team member to your workspace' })
  @ApiBody({ type: InviteMemberDto })
  @Post('invite')
  async invite(
    @GetUser('id') userId: string,
    @GetBusinessId() businessId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamsService.invite(userId, businessId, dto);
  }

  @ApiOperation({ summary: 'List active team members' })
  @Get('members')
  async listMembers(@GetBusinessId() businessId: string) {
    return this.teamsService.listMembers(businessId);
  }

  @ApiOperation({ summary: 'List pending invitations' })
  @Get('invitations')
  async listInvitations(@GetBusinessId() businessId: string) {
    return this.teamsService.listInvitations(businessId);
  }

  @ApiOperation({ summary: 'Update a team member (role, permissions, status)' })
  @ApiParam({ name: 'id', description: 'Business user member ID' })
  @ApiBody({ type: UpdateMemberDto })
  @Patch('members/:id')
  async updateMember(
    @GetBusinessId() businessId: string,
    @Param('id', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamsService.updateMember(businessId, memberId, dto);
  }

  @ApiOperation({ summary: 'Remove a team member from your workspace' })
  @ApiParam({ name: 'id', description: 'Business user member ID' })
  @Delete('members/:id')
  async removeMember(
    @GetBusinessId() businessId: string,
    @Param('id', ParseUUIDPipe) memberId: string,
  ) {
    return this.teamsService.removeMember(businessId, memberId);
  }

  @Public()
  @ApiOperation({ summary: 'Accept a team invitation and set up your account' })
  @ApiBody({ type: AcceptInviteDto })
  @Post('accept')
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.teamsService.acceptInvite(dto);
  }
}
