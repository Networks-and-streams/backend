import { plainToInstance } from 'class-transformer';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';

import { ComputeRequestDto } from './compute-request.dto';
import { GraphDto } from './graph.dto';
import { assertValidGraph, MAX_EDGES, MAX_VERTICES } from '../validation/graph.validation';

const validGraph = {
  vertices: 4,
  source: 1,
  edges: [
    { from: 1, to: 2, weight: 5 },
    { from: 2, to: 4, weight: 7 },
  ],
};

async function validateGraphDto(input: unknown) {
  return validate(plainToInstance(GraphDto, input));
}

describe('GraphDto (class-validator shape rules)', () => {
  it('accepts a valid graph', async () => {
    expect(await validateGraphDto(validGraph)).toHaveLength(0);
  });

  it('rejects non-integer vertices', async () => {
    const errors = await validateGraphDto({ ...validGraph, vertices: 1.5 });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects vertices below 1', async () => {
    const errors = await validateGraphDto({ ...validGraph, vertices: 0 });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects a non-array edges field', async () => {
    const errors = await validateGraphDto({ ...validGraph, edges: 'nope' });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects more than MAX_EDGES edges', async () => {
    const edges = Array.from({ length: MAX_EDGES + 1 }, () => ({ from: 1, to: 1, weight: 0 }));
    const errors = await validateGraphDto({ vertices: 1, source: 1, edges });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects negative weights at the property level', async () => {
    const errors = await validateGraphDto({
      ...validGraph,
      edges: [{ from: 1, to: 2, weight: -1 }],
    });
    expect(errors).not.toHaveLength(0);
  });
});

describe('assertValidGraph (cross-field rules shared by /graphs and /graph/compute)', () => {
  it('accepts a valid graph', () => {
    expect(() => assertValidGraph(validGraph)).not.toThrow();
  });

  it('rejects source > vertices', () => {
    expect(() => assertValidGraph({ ...validGraph, source: 5 })).toThrow('Invalid graph');
  });

  it('rejects edge endpoints outside 1..vertices', () => {
    expect(() => assertValidGraph({ ...validGraph, edges: [{ from: 0, to: 2, weight: 1 }] })).toThrow();
    expect(() => assertValidGraph({ ...validGraph, edges: [{ from: 1, to: 5, weight: 1 }] })).toThrow();
  });

  it('rejects vertices above the hard limit', () => {
    expect(() => assertValidGraph({ vertices: MAX_VERTICES + 1, source: 1, edges: [] })).toThrow();
  });

  it('rejects non-integer weights', () => {
    expect(() => assertValidGraph({ ...validGraph, edges: [{ from: 1, to: 2, weight: 1.5 }] })).toThrow();
  });

  it('reports every violated rule at once', () => {
    try {
      assertValidGraph({ vertices: 0, source: 0, edges: [{ from: 9, to: 9, weight: -1 }] });
      throw new Error('should have thrown');
    } catch (err) {
      const body = (err as { response?: { errors?: string[] } }).response;
      expect(body?.errors?.length).toBeGreaterThan(2);
    }
  });
});

describe('ComputeRequestDto', () => {
  async function validateDto(input: unknown) {
    return validate(plainToInstance(ComputeRequestDto, input));
  }

  it('accepts a valid flow request with sink', async () => {
    expect(
      await validateDto({ algorithm: 'ford_fulkerson', graph: validGraph, include_steps: true, sink: 4 }),
    ).toHaveLength(0);
  });

  it('rejects an unknown algorithm', async () => {
    const errors = await validateDto({ algorithm: 'dijkstra_xyz', graph: validGraph });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects a sink below 1', async () => {
    const errors = await validateDto({ algorithm: 'ford_fulkerson', graph: validGraph, sink: 0 });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects unknown top-level fields under the global ValidationPipe contract', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(
      pipe.transform({ algorithm: 'minty', graph: validGraph, foo: 1 }, {
        type: 'body',
        metatype: ComputeRequestDto,
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('defaults include_steps to true when omitted', async () => {
    const dto = plainToInstance(ComputeRequestDto, { algorithm: 'minty', graph: validGraph });
    expect(dto.include_steps).toBe(true);
  });

  it('keeps an explicit include_steps=false', async () => {
    const dto = plainToInstance(ComputeRequestDto, {
      algorithm: 'minty',
      graph: validGraph,
      include_steps: false,
    });
    expect(dto.include_steps).toBe(false);
  });
});
