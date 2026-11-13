import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ComputeRequestDto } from './dto/compute-request.dto';
import { GraphService, type ComputeHttpResult } from './graph.service';

@ApiTags('Graph')
@ApiBearerAuth('JWT-auth')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Post('compute')
  // Computation is not a resource creation: the contract (expansion plan §2.2)
  // is HTTP 200 with `{ status, algorithm, result, steps }`.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Execute a graph algorithm on the compute service',
    description:
      'Runs minty (shortest paths) or ford_fulkerson / edmonds_karp (max flow + min cut) ' +
      'through the Rust compute service over gRPC. Returns the parsed result and, when ' +
      'include_steps is true, the execution trace for animation. Flow algorithms require ' +
      'the 1-based "sink" field.',
  })
  @ApiOkResponse({
    description: 'Computation succeeded (status: ok, parsed result + steps)',
  })
  @ApiBadRequestResponse({ description: 'Invalid graph, algorithm or missing sink' })
  @ApiUnprocessableEntityResponse({ description: 'Algorithm execution failed (compute-side)' })
  @ApiInternalServerErrorResponse({ description: 'Compute returned malformed data' })
  async compute(@Body() dto: ComputeRequestDto): Promise<ComputeHttpResult> {
    return this.graphService.compute(dto);
  }
}
