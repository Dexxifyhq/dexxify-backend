import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({
    summary: 'Root endpoint',
    description: 'Returns welcome message for the API',
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
