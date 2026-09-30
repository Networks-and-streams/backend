import { BadRequestException } from '@nestjs/common';
import { GraphDto } from '@/graph/dto/compute-request.dto';

/**
 * Semantic graph validation used when persisting reusable graphs.
 *
 * The DTO layer (`GraphDto` / `EdgeDto`) guarantees the *shape* of the payload
 * (types and required fields). This helper enforces the *domain* rules that
 * the solver contract (compute/README.md + compute/graph.rs) relies on:
 *
 * - 1-indexed vertices, source within `1..vertices`
 * - edge endpoints reference existing vertices
 * - non-negative integer weights
 *
 * Keeping this mirror of the solver's own validation here means a graph that
 * passes `POST /graphs` is guaranteed to be runnable by the compute service.
 */

export function assertValidGraphData(graph: GraphDto): void {
  const { vertices, edges, source } = graph;

  if (!Number.isInteger(vertices) || vertices < 1) {
    throw new BadRequestException('Graph is invalid: vertices must be a positive integer');
  }

  if (!Number.isInteger(source) || source < 1 || source > vertices) {
    throw new BadRequestException('Graph is invalid: source must be an integer within 1..vertices');
  }

  if (!Array.isArray(edges)) {
    throw new BadRequestException('Graph is invalid: edges must be an array');
  }

  for (const edge of edges) {
    if (!Number.isInteger(edge.from) || edge.from < 1 || edge.from > vertices) {
      throw new BadRequestException('Graph is invalid: each edge "from" must be an integer within 1..vertices');
    }
    if (!Number.isInteger(edge.to) || edge.to < 1 || edge.to > vertices) {
      throw new BadRequestException('Graph is invalid: each edge "to" must be an integer within 1..vertices');
    }
    if (!Number.isInteger(edge.weight) || edge.weight < 0) {
      throw new BadRequestException('Graph is invalid: each edge "weight" must be a non-negative integer');
    }
  }
}
