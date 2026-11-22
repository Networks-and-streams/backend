import { Injectable } from '@nestjs/common';
import { SavedGraph } from '@/generated/prisma/client';
import { SavedGraphDataDto } from './dto/saved-graph-data.dto';
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
      graph: graph.graph as unknown as SavedGraphDataDto,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
    };
  }

  toResponses(graphs: SavedGraph[]): SavedGraphResponseDto[] {
    return graphs.map((graph) => this.toResponse(graph));
  }
}
