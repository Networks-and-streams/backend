import { Injectable } from '@nestjs/common';
import { SavedGraph } from '@/generated/prisma/client';
import { GraphDto } from '@/graph/dto/compute-request.dto';
import { SavedGraphResponseDto } from './dto/saved-graph-response.dto';

/**
 * Maps persisted SavedGraph records to the API response shape.
 * `userId` is intentionally excluded: the owner is derived from the
 * authenticated request context, never exposed to clients.
 */
@Injectable()
export class SavedGraphsMapper {
  toResponse(graph: SavedGraph): SavedGraphResponseDto {
    return {
      id: graph.id,
      name: graph.name,
      graph: graph.graph as unknown as GraphDto,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
    };
  }

  toResponses(graphs: SavedGraph[]): SavedGraphResponseDto[] {
    return graphs.map((graph) => this.toResponse(graph));
  }
}
