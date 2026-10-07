import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { PrismaContextService } from '@/core/prisma';
import { CreateSavedGraphDto } from './dto/create-saved-graph.dto';
import { UpdateSavedGraphDto } from './dto/update-saved-graph.dto';
import { assertValidGraphData } from './graph-data.validation';

@Injectable()
export class SavedGraphsService {
  constructor(private readonly db: PrismaContextService) {}

  /**
   * Persists a reusable graph for the authenticated user.
   * `userId` is always derived from the request context — never from the body.
   */
  async create(userId: string, dto: CreateSavedGraphDto) {
    assertValidGraphData(dto.graph);

    return this.db.client.savedGraph.create({
      data: {
        userId,
        name: dto.name,
        graph: dto.graph as unknown as Prisma.InputJsonValue,
      },
    });
  }

  findAllByUser(userId: string) {
    return this.db.client.savedGraph.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOwnedByIdOrThrow(userId: string, id: string) {
    const graph = await this.db.client.savedGraph.findFirst({
      where: { id, userId },
    });
    if (!graph) {
      throw new NotFoundException('Saved graph not found');
    }
    return graph;
  }

  async update(userId: string, id: string, dto: UpdateSavedGraphDto) {
    if (dto.name === undefined && dto.graph === undefined) {
      throw new BadRequestException('Provide at least one of "name" or "graph"');
    }

    // Ownership + existence check — a graph belonging to another user is
    // indistinguishable from a missing one (404), so nothing leaks.
    await this.findOwnedByIdOrThrow(userId, id);

    if (dto.graph !== undefined) {
      assertValidGraphData(dto.graph);
    }

    const data: Prisma.SavedGraphUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.graph !== undefined) data.graph = dto.graph as unknown as Prisma.InputJsonValue;

    return this.db.client.savedGraph.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwnedByIdOrThrow(userId, id);
    await this.db.client.savedGraph.delete({ where: { id } });
  }
}
