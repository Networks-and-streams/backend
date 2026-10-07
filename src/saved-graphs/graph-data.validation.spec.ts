import { BadRequestException } from '@nestjs/common';
import { assertValidGraphData } from './graph-data.validation';
import { SavedGraphDataDto } from './dto/saved-graph-data.dto';

const base: SavedGraphDataDto = {
  vertices: 2,
  source: 1,
  edges: [{ from: 1, to: 2, weight: 3 }],
};

describe('assertValidGraphData — extra edge parameters', () => {
  it('accepts parameters with values on some edges only', () => {
    expect(() =>
      assertValidGraphData({
        ...base,
        metrics: [{ key: 'm1', name: 'Throughput', aggregate: 'min' }],
        edges: [
          { from: 1, to: 2, weight: 3, values: { m1: 7.5 } },
          { from: 2, to: 1, weight: 1 },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects a value for an undefined parameter', () => {
    expect(() => assertValidGraphData({ ...base, edges: [{ from: 1, to: 2, weight: 3, values: { m9: 1 } }] })).toThrow(
      BadRequestException,
    );
  });

  it('rejects non-numeric or infinite values', () => {
    const metrics = [{ key: 'm1', name: 'Time', aggregate: 'sum' as const }];
    expect(() =>
      assertValidGraphData({
        ...base,
        metrics,
        edges: [{ from: 1, to: 2, weight: 3, values: { m1: 'x' as unknown as number } }],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidGraphData({ ...base, metrics, edges: [{ from: 1, to: 2, weight: 3, values: { m1: Infinity } }] }),
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate parameter keys', () => {
    expect(() =>
      assertValidGraphData({
        ...base,
        metrics: [
          { key: 'm1', name: 'A', aggregate: 'sum' },
          { key: 'm1', name: 'B', aggregate: 'min' },
        ],
      }),
    ).toThrow(BadRequestException);
  });
});
