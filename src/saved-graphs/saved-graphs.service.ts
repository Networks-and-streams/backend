import { Injectable, NotFoundException } from '@nestjs/common';

import type { SavedGraph } from '@/generated/prisma/client';
import { PrismaContextService } from '@/core/prisma';
import { assertValidGraph } from '@/graph/validation/graph.validation';

import { CreateSavedGraphDto, UpdateSavedGraphDto } from './dto/saved-graph.dto';

/**
 * CRUD over the authenticated user's saved graphs.
 *
 * Ownership is enforced at the query level (every lookup filters by
 * `userId`), so a foreign id is indistinguishable from a missing one —
 * both yield 404 and leak nothing.
 */
@Injectable()
export class SavedGraphsService {
  constructor(private readonly db: PrismaContextService) {}

  findAllByUser(userId: string): Promise<SavedGraph[]> {
    return this.db.client.savedGraph.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOneForUser(id: string, userId: string): Promise<SavedGraph> {
    const graph = await this.db.client.savedGraph.findFirst({ where: { id, userId } });
    if (!graph) {
      throw new NotFoundException('Saved graph not found');
    }
    return graph;
  }

  async create(userId: string, dto: CreateSavedGraphDto): Promise<SavedGraph> {
    assertValidGraph(dto.graph);
    return this.db.client.savedGraph.create({
      data: {
        userId,
        name: dto.name,
        graph: dto.graph as unknown as object,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateSavedGraphDto): Promise<SavedGraph> {
    await this.findOneForUser(id, userId);
    if (dto.graph) {
      assertValidGraph(dto.graph);
    }
    return this.db.client.savedGraph.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.graph !== undefined ? { graph: dto.graph as unknown as object } : {}),
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOneForUser(id, userId);
    await this.db.client.savedGraph.delete({ where: { id } });
  }
}
