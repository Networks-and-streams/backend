import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ComputeClientService, ComputeUnavailableError } from './grpc/compute-client.service';
import {
  COMPUTE_CLIENT_ERROR_STATUSES,
  COMPUTE_EXECUTION_ERROR_STATUS,
  COMPUTE_OK,
  type ComputeGrpcResponse,
  type ComputeResultJson,
  type ComputeStepJson,
} from './grpc/compute.types';
import { assertValidGraph, isFlowAlgorithm } from './validation/graph.validation';
import type { ComputeRequestDto } from './dto/compute-request.dto';

/** Parsed 200-OK body of `POST /graph/compute` (format fixed for the frontend). */
export interface ComputeHttpResult {
  status: typeof COMPUTE_OK;
  algorithm: string;
  result: ComputeResultJson;
  steps: ComputeStepJson[];
}

/**
 * Orchestrates `POST /graph/compute`: validate → call compute over gRPC →
 * parse the JSON payloads → map compute statuses onto HTTP codes.
 *
 * Status mapping (see expansion plan §2.2):
 *  ok                        → 200
 *  InvalidRequest/Graph/...  → 400
 *  AlgorithmExecutionError   → 422
 *  transport failure/timeout → 503
 *  unknown / broken JSON     → 500
 */
@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(private readonly computeClient: ComputeClientService) {}

  async compute(dto: ComputeRequestDto): Promise<ComputeHttpResult> {
    assertValidGraph(dto.graph);

    if (isFlowAlgorithm(dto.algorithm) && dto.sink === undefined) {
      throw new BadRequestException({
        message: `Algorithm "${dto.algorithm}" requires a sink vertex`,
        errors: ['sink is required for flow algorithms (1-based vertex id)'],
      });
    }

    let response: ComputeGrpcResponse;
    try {
      response = await this.computeClient.execute({
        algorithm: dto.algorithm,
        graph: {
          vertices: dto.graph.vertices,
          edges: dto.graph.edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight })),
          source: dto.graph.source,
        },
        include_steps: dto.include_steps ?? true,
        sink: dto.sink ?? null,
        target: null,
      });
    } catch (err) {
      if (err instanceof ComputeUnavailableError) {
        // compute down / deadline exceeded → 503
        throw new ServiceUnavailableException('Compute service unavailable');
      }
      throw err;
    }

    return this.mapResponse(dto.algorithm, response);
  }

  private mapResponse(algorithm: string, response: ComputeGrpcResponse): ComputeHttpResult {
    switch (response.status) {
      case COMPUTE_OK:
        return {
          status: COMPUTE_OK,
          algorithm,
          result: this.parseJson(response.result_json, 'result'),
          steps: this.parseJson(response.steps_json, 'steps'),
        };

      case COMPUTE_EXECUTION_ERROR_STATUS:
        throw new UnprocessableEntityException({
          message: 'Algorithm execution failed',
          errors: [response.error || 'compute returned no details'],
        });

      default:
        if ((COMPUTE_CLIENT_ERROR_STATUSES as readonly string[]).includes(response.status)) {
          throw new BadRequestException({
            message: response.status,
            errors: [response.error || 'compute rejected the request'],
          });
        }
        this.logger.error(`unexpected compute status "${response.status}": ${response.error}`);
        throw new InternalServerErrorException('Compute service returned an unknown status');
    }
  }

  private parseJson<T>(raw: string, part: 'result' | 'steps'): T {
    if (!raw) {
      // An empty steps_json legitimately encodes "[]"… but an empty result is not.
      if (part === 'steps') return [] as T;
      throw new InternalServerErrorException('Compute service returned an empty result');
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.error(`compute returned invalid ${part} JSON: ${raw.slice(0, 300)}`);
      throw new InternalServerErrorException(`Compute service returned invalid ${part} JSON`);
    }
  }
}
