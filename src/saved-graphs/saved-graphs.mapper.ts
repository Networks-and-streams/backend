import { Injectable } from '@nestjs/common';

import type { SavedGraph } from '@/generated/prisma/client';
import type { GraphDto } from '@/graph/dto/graph.dto';

import { SavedGraphResponseDto } from './dto/saved-graph-response.dto';

/** Maps Prisma `SavedGraph` rows to the public API response shape. */
@Injectable()
export class SavedGraphsMapper {
  toResponse(graph: SavedGraph): SavedGraphResponseDto {
    return {
      id: graph.id,
      name: graph.name,
      // Prisma returns JsonValue; the service guarantees a validated graph.
      graph: graph.graph as unknown as GraphDto,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
    };
  }

  toResponses(graphs: SavedGraph[]): SavedGraphResponseDto[] {
    return graphs.map((graph) => this.toResponse(graph));
  }
}
