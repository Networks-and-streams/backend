import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { GraphService } from './graph.service';
import { ComputeClientService, ComputeUnavailableError } from './grpc/compute-client.service';
import type { ComputeRequestDto } from './dto/compute-request.dto';

const validGraph = {
  vertices: 4,
  source: 1,
  edges: [
    { from: 1, to: 2, weight: 5 },
    { from: 2, to: 4, weight: 7 },
  ],
};

const ffResult = {
  algorithm: 'ford_fulkerson',
  mode: 'dfs',
  max_flow: 5,
  source: 1,
  sink: 4,
  flows: [{ index: 0, from: 1, to: 2, flow: 5, capacity: 5 }],
  min_cut: { value: 5, source_side: [1, 3], sink_side: [2, 4], edges: [{ index: 0, from: 1, to: 2, capacity: 5 }] },
};

const ffSteps = [
  {
    iteration: 1,
    augmenting_path: [1, 2, 4],
    bottleneck: 5,
    flows: [{ index: 0, from: 1, to: 2, flow: 5 }],
    max_flow_so_far: 5,
  },
];

function grpcOk(result: unknown, steps: unknown = []) {
  return {
    status: 'ok',
    result_json: JSON.stringify(result),
    steps_json: JSON.stringify(steps),
    error: '',
  };
}

describe('GraphService', () => {
  let service: GraphService;
  let client: { execute: jest.Mock };

  const flowDto = (): ComputeRequestDto =>
    ({ algorithm: 'ford_fulkerson', graph: validGraph, include_steps: true, sink: 4 }) as ComputeRequestDto;

  beforeEach(async () => {
    client = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphService, { provide: ComputeClientService, useValue: client }],
    }).compile();
    service = module.get(GraphService);
  });

  describe('happy path', () => {
    it('parses result_json and steps_json into objects', async () => {
      client.execute.mockResolvedValue(grpcOk(ffResult, ffSteps));

      const out = await service.compute(flowDto());

      expect(out).toEqual({ status: 'ok', algorithm: 'ford_fulkerson', result: ffResult, steps: ffSteps });
      // gRPC request carries the normalized graph and the sink.
      expect(client.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          algorithm: 'ford_fulkerson',
          include_steps: true,
          sink: 4,
          graph: validGraph,
        }),
      );
    });

    it('defaults include_steps to true when the field is absent', async () => {
      client.execute.mockResolvedValue(grpcOk(ffResult));
      await service.compute({ algorithm: 'minty', graph: validGraph } as ComputeRequestDto);
      expect(client.execute.mock.calls[0][0].include_steps).toBe(true);
    });

    it('returns [] for an empty steps payload', async () => {
      client.execute.mockResolvedValue({ status: 'ok', result_json: '{"max_flow":1}', steps_json: '', error: '' });
      const out = await service.compute(flowDto());
      expect(out.steps).toEqual([]);
    });
  });

  describe('input validation', () => {
    it('rejects an edge endpoint beyond vertices before calling compute', async () => {
      const dto = {
        algorithm: 'minty',
        graph: { ...validGraph, edges: [{ from: 1, to: 9, weight: 1 }] },
      } as ComputeRequestDto;
      await expect(service.compute(dto)).rejects.toThrow(BadRequestException);
      expect(client.execute).not.toHaveBeenCalled();
    });

    it('rejects source > vertices', async () => {
      const dto = { algorithm: 'minty', graph: { ...validGraph, source: 7 } } as ComputeRequestDto;
      await expect(service.compute(dto)).rejects.toThrow(BadRequestException);
      expect(client.execute).not.toHaveBeenCalled();
    });

    it('requires sink for ford_fulkerson', async () => {
      const dto = { algorithm: 'ford_fulkerson', graph: validGraph } as ComputeRequestDto;
      await expect(service.compute(dto)).rejects.toThrow(BadRequestException);
      expect(client.execute).not.toHaveBeenCalled();
    });

    it('requires sink for edmonds_karp', async () => {
      const dto = { algorithm: 'edmonds_karp', graph: validGraph } as ComputeRequestDto;
      await expect(service.compute(dto)).rejects.toThrow(BadRequestException);
    });

    it('does not require sink for minty', async () => {
      client.execute.mockResolvedValue(grpcOk({ source: 1, distances: {}, paths: {} }));
      await expect(
        service.compute({ algorithm: 'minty', graph: validGraph } as ComputeRequestDto),
      ).resolves.toMatchObject({ status: 'ok' });
    });
  });

  describe('compute status mapping', () => {
    const dtoWithGraph = (algorithm: string, graph = validGraph): ComputeRequestDto =>
      ({ algorithm, graph, include_steps: false, sink: 4 }) as ComputeRequestDto;

    it.each(['InvalidRequest', 'InvalidGraph', 'InvalidAlgorithmInput', 'UnsupportedAlgorithm'])(
      '%s maps to 400',
      async (status) => {
        client.execute.mockResolvedValue({ status, result_json: '', steps_json: '', error: 'bad input' });
        await expect(service.compute(dtoWithGraph('minty'))).rejects.toThrow(BadRequestException);
      },
    );

    it('AlgorithmExecutionError maps to 422', async () => {
      client.execute.mockResolvedValue({
        status: 'AlgorithmExecutionError',
        result_json: '',
        steps_json: '',
        error: 'flow did not converge',
      });
      await expect(service.compute(dtoWithGraph('minty'))).rejects.toThrow(UnprocessableEntityException);
    });

    it('an unknown status maps to 500', async () => {
      client.execute.mockResolvedValue({ status: '???', result_json: '', steps_json: '', error: '' });
      await expect(service.compute(dtoWithGraph('minty'))).rejects.toThrow(InternalServerErrorException);
    });

    it('transport failure maps to 503', async () => {
      client.execute.mockRejectedValue(new ComputeUnavailableError('deadline exceeded'));
      await expect(service.compute(dtoWithGraph('minty'))).rejects.toThrow(ServiceUnavailableException);
    });

    it('non-ComputeUnavailableError propagates unchanged', async () => {
      client.execute.mockRejectedValue(new TypeError('boom'));
      await expect(service.compute(dtoWithGraph('minty'))).rejects.toThrow(TypeError);
    });
  });

  describe('malformed payloads', () => {
    it('invalid result JSON maps to 500', async () => {
      client.execute.mockResolvedValue({ status: 'ok', result_json: '{oops', steps_json: '[]', error: '' });
      const dto = { algorithm: 'minty', graph: validGraph } as ComputeRequestDto;
      await expect(service.compute(dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('empty result_json maps to 500', async () => {
      client.execute.mockResolvedValue({ status: 'ok', result_json: '', steps_json: '[]', error: '' });
      const dto = { algorithm: 'minty', graph: validGraph } as ComputeRequestDto;
      await expect(service.compute(dto)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
