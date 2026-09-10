import {
  Controller,
  ForbiddenException,
  MessageEvent,
  Sse,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';

const HEARTBEAT_INTERVAL_MS = 20000;

@ApiTags('Realtime')
@DualAuth()
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @ApiOperation({
    summary: 'Live event stream (SSE) for the current business + mode',
    description:
      'Pushes the same events dispatched to configured webhooks — payment, deposit, payout, swap, refund, etc. — to the dashboard in real time. Connect with EventSource({ withCredentials: true }) and listen per event name (e.g. addEventListener("payment.completed", ...)).',
  })
  @Sse('events')
  events(
    @GetBusinessId() businessId: string | null,
    @GetMode() mode: 'live' | 'test',
  ): Observable<MessageEvent> {
    if (!businessId) {
      throw new ForbiddenException('Select a business first.');
    }

    const heartbeat = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: {} })),
    );

    return merge(this.realtime.subscribe(businessId, mode), heartbeat);
  }
}
