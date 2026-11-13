import { BadRequestException } from '@nestjs/common';

/**
 * Graph payload validation shared by the saved-graphs (`/graphs`) and
 * compute (`/graph/compute`) modules.
 *
 * The project-wide convention is 1-BASED vertices (see compute's
 * `GraphInput::validate`: source >= 1, every edge endpoint in 1..=vertices).
 */

/** Hard limits protecting the compute service from pathological inputs. */
export const MAX_VERTICES = 10_000;
export const MAX_EDGES = 100_000;
/** Weights/capacities are integers fitting into the compute side i64. */
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER

export interface GraphLike {
  vertices: number;
  edges: { from: number; to: number; weight: number }[];
  source: number;
}

/**
 * Cross-field checks that class-validator cannot express per-property
 * (endpoint ranges vs `vertices`, etc.).
 *
 * @throws BadRequestException listing every violated rule.
 */
export function assertValidGraph(graph: GraphLike): void {
  const errors: string[] = [];

  if (!Number.isInteger(graph.vertices) || graph.vertices < 1 || graph.vertices > MAX_VERTICES) {
    errors.push(`vertices must be an integer in 1..${MAX_VERTICES}`);
  }
  if (!Array.isArray(graph.edges) || graph.edges.length > MAX_EDGES) {
    errors.push(`edges must be an array of at most ${MAX_EDGES} items`);
  }
  if (!Number.isInteger(graph.source) || graph.source < 1) {
    errors.push('source must be a 1-based integer');
  }

  const vertices = Number.isInteger(graph.vertices) ? graph.vertices : 0;
  if (vertices >= 1 && graph.source > vertices) {
    errors.push(`source ${graph.source} exceeds vertices ${vertices}`);
  }

  if (Array.isArray(graph.edges)) {
    graph.edges.forEach((edge, index) => {
      if (!Number.isInteger(edge?.from) || edge.from < 1 || edge.from > vertices) {
        errors.push(`edges[${index}].from must be in 1..${vertices}`);
      }
      if (!Number.isInteger(edge?.to) || edge.to < 1 || edge.to > vertices) {
        errors.push(`edges[${index}].to must be in 1..${vertices}`);
      }
      if (!Number.isInteger(edge?.weight) || edge.weight < MIN_WEIGHT || edge.weight > MAX_WEIGHT) {
        errors.push(`edges[${index}].weight must be an integer in ${MIN_WEIGHT}..${MAX_WEIGHT}`);
      }
    });
  }

  if (errors.length > 0) {
    throw new BadRequestException({ message: 'Invalid graph', errors });
  }
}

/** Algorithms the compute dispatcher accepts (mirrors `compute/src/dispatcher.rs`). */
export const COMPUTE_ALGORITHMS = ['minty', 'ford_fulkerson', 'edmonds_karp'] as const;
export type ComputeAlgorithm = (typeof COMPUTE_ALGORITHMS)[number];

/** Flow algorithms require an explicit sink vertex (compute contract). */
export function isFlowAlgorithm(algorithm: string): algorithm is 'ford_fulkerson' | 'edmonds_karp' {
  return algorithm === 'ford_fulkerson' || algorithm === 'edmonds_karp';
}
