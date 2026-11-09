import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { MetricsService } from './metrics.service';
import { MetricsTokenGuard } from './metrics-token.guard';

@Controller('metrics')
@UseGuards(MetricsTokenGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(@Res() response: Response): Promise<void> {
    const output = await this.metrics.render();

    response.setHeader('Content-Type', this.metrics.contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).send(output);
  }
}
