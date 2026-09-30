// src/graph/graph.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { ComputeRequestDto } from './dto/compute-request.dto';
import { firstValueFrom } from 'rxjs';

@ApiTags('Graph Computation')
@ApiBearerAuth('JWT-auth')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) { }

  @Post('compute')
  @ApiOperation({ summary: 'Запуск алгоритма на графе через Rust gRPC-микросервис' })
  @ApiResponse({ status: 200, description: 'Успешный расчет' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации или выполнения' })
  async compute(@Body() body: ComputeRequestDto) {
    // Передаем данные в Rust gRPC сервис (учитываем snake_case / camelCase структуру)
    const response$ = await this.graphService.runComputation(body.algorithm, {
      vertices: body.graph.vertices,
      edges: body.graph.edges,
      source: body.graph.source,
    });

    const result = await firstValueFrom(response$);

    return {
      status: result.status,
      result: result.resultJson ? JSON.parse(result.resultJson) : null,
      steps: result.stepsJson ? JSON.parse(result.stepsJson) : null,
      error: result.error,
    };
  }
}
