// src/graph/graph.controller.ts
import { Controller, Post, Body, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { ComputeQuota, ComputeQuotaService } from './compute-quota.service';
import { ComputeRequestDto } from './dto/compute-request.dto';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('Graph Computation')
@ApiBearerAuth('JWT-auth')
@Controller('graph')
export class GraphController {
  constructor(
    private readonly graphService: GraphService,
    private readonly quotaService: ComputeQuotaService,
  ) {}

  @Get('quota')
  @ApiOperation({ summary: 'Remaining algorithm runs for the current user today' })
  getQuota(@CurrentUser('id') userId: string): Promise<ComputeQuota> {
    return this.quotaService.getQuota(userId);
  }

  @Post('compute')
  @ApiOperation({ summary: 'Запуск алгоритма на графе через Rust gRPC-микросервис' })
  @ApiResponse({ status: 200, description: 'Успешный расчет' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации или выполнения' })
  @ApiResponse({ status: 429, description: 'Free daily run limit reached' })
  async compute(@CurrentUser('id') userId: string, @Body() body: ComputeRequestDto) {
    const { refund } = await this.quotaService.reserve(userId);

    const result = await this.callCompute(body).catch(async () => {
      await refund();
      throw new ServiceUnavailableException('Compute service is unavailable. Please try again later.');
    });

    // Only successful runs count against the daily allowance.
    if (result.status !== 'ok') await refund();

    return {
      status: result.status,
      result: result.resultJson ? JSON.parse(result.resultJson) : null,
      steps: result.stepsJson ? JSON.parse(result.stepsJson) : null,
      error: result.error,
      quota: await this.quotaService.getQuota(userId),
    };
  }

  private async callCompute(body: ComputeRequestDto) {
    // Передаем данные в Rust gRPC сервис (учитываем snake_case / camelCase структуру)
    const response$ = await this.graphService.runComputation(
      body.algorithm,
      {
        vertices: body.graph.vertices,
        edges: body.graph.edges,
        source: body.graph.source,
      },
      body.target,
    );
    return firstValueFrom(response$);
  }
}
