import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaContextService } from '@/core/prisma';
import { SavedGraphsService } from './saved-graphs.service';

function createMockPrismaContext() {
  return {
    client: {
      savedGraph: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    },
  };
}

const validGraph = {
  vertices: 4,
  source: 1,
  edges: [
    { from: 1, to: 2, weight: 5 },
    { from: 2, to: 3, weight: 10 },
  ],
};

const baseRecord = {
  id: 'graph-1',
  userId: 'user-1',
  name: 'Dijkstra test graph',
  graph: validGraph,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

describe('SavedGraphsService', () => {
  let service: SavedGraphsService;
  let prisma: ReturnType<typeof createMockPrismaContext>;

  beforeEach(async () => {
    prisma = createMockPrismaContext();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SavedGraphsService, { provide: PrismaContextService, useValue: prisma }],
    }).compile();

    service = module.get<SavedGraphsService>(SavedGraphsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('persists the graph with the owner derived from context', async () => {
      prisma.client.savedGraph.create.mockResolvedValue(baseRecord);

      const result = await service.create('user-1', { name: 'Dijkstra test graph', graph: validGraph });

      expect(prisma.client.savedGraph.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Dijkstra test graph',
          graph: validGraph,
        },
      });
      expect(result).toEqual(baseRecord);
    });

    it.each([
      ['zero vertices', { vertices: 0, source: 1, edges: [] }],
      ['source out of range', { vertices: 4, source: 5, edges: [] }],
      ['non-integer vertex count', { vertices: 2.5, source: 1, edges: [] }],
      ['edge from out of range', { vertices: 4, source: 1, edges: [{ from: 5, to: 2, weight: 1 }] }],
      ['edge to out of range', { vertices: 4, source: 1, edges: [{ from: 1, to: 0, weight: 1 }] }],
      ['non-integer edge endpoint', { vertices: 4, source: 1, edges: [{ from: 1.5, to: 2, weight: 1 }] }],
      ['negative weight', { vertices: 4, source: 1, edges: [{ from: 1, to: 2, weight: -3 }] }],
      ['non-integer weight', { vertices: 4, source: 1, edges: [{ from: 1, to: 2, weight: 1.5 }] }],
    ])('rejects invalid graph (%s)', async (_label, graph) => {
      await expect(service.create('user-1', { name: 'Bad graph', graph: graph as never })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.client.savedGraph.create).not.toHaveBeenCalled();
    });

    it('rejects graphs whose edges reference missing vertices', async () => {
      const graph = { vertices: 2, source: 1, edges: [{ from: 1, to: 3, weight: 1 }] };
      await expect(service.create('user-1', { name: 'Bad graph', graph: graph as never })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAllByUser', () => {
    it('lists only the current user graphs, most recently updated first', async () => {
      prisma.client.savedGraph.findMany.mockResolvedValue([baseRecord]);

      const result = await service.findAllByUser('user-1');

      expect(prisma.client.savedGraph.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual([baseRecord]);
    });
  });

  describe('findOwnedByIdOrThrow', () => {
    it('returns the graph when it exists and belongs to the user', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(baseRecord);

      const result = await service.findOwnedByIdOrThrow('user-1', 'graph-1');

      expect(prisma.client.savedGraph.findFirst).toHaveBeenCalledWith({
        where: { id: 'graph-1', userId: 'user-1' },
      });
      expect(result).toEqual(baseRecord);
    });

    it('throws NotFoundException when the graph does not exist', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(null);

      await expect(service.findOwnedByIdOrThrow('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for a graph owned by another user (no existence leak)', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(null);

      await expect(service.findOwnedByIdOrThrow('user-2', 'graph-1')).rejects.toThrow(NotFoundException);

      expect(prisma.client.savedGraph.findFirst).toHaveBeenCalledWith({
        where: { id: 'graph-1', userId: 'user-2' },
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(baseRecord);
    });

    it('updates only the name when graph data is not provided', async () => {
      prisma.client.savedGraph.update.mockResolvedValue({ ...baseRecord, name: 'Renamed' });

      const result = await service.update('user-1', 'graph-1', { name: 'Renamed' });

      expect(prisma.client.savedGraph.update).toHaveBeenCalledWith({
        where: { id: 'graph-1' },
        data: { name: 'Renamed' },
      });
      expect(result).toEqual({ ...baseRecord, name: 'Renamed' });
    });

    it('updates only the graph data when name is not provided', async () => {
      const newGraph = { vertices: 3, source: 1, edges: [{ from: 1, to: 2, weight: 7 }] };
      prisma.client.savedGraph.update.mockResolvedValue({ ...baseRecord, graph: newGraph });

      await service.update('user-1', 'graph-1', { graph: newGraph });

      expect(prisma.client.savedGraph.update).toHaveBeenCalledWith({
        where: { id: 'graph-1' },
        data: { graph: newGraph },
      });
    });

    it('rejects an empty update with no fields', async () => {
      await expect(service.update('user-1', 'graph-1', {})).rejects.toThrow(BadRequestException);
      expect(prisma.client.savedGraph.update).not.toHaveBeenCalled();
    });

    it('validates graph data before persisting', async () => {
      const invalid = { vertices: 2, source: 1, edges: [{ from: 1, to: 2, weight: -1 }] };
      await expect(service.update('user-1', 'graph-1', { graph: invalid as never })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.client.savedGraph.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the graph is not owned by the user', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(null);

      await expect(service.update('user-2', 'graph-1', { name: 'Hijack' })).rejects.toThrow(NotFoundException);
      expect(prisma.client.savedGraph.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an owned graph', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(baseRecord);
      prisma.client.savedGraph.delete.mockResolvedValue(baseRecord);

      await service.remove('user-1', 'graph-1');

      expect(prisma.client.savedGraph.findFirst).toHaveBeenCalledWith({
        where: { id: 'graph-1', userId: 'user-1' },
      });
      expect(prisma.client.savedGraph.delete).toHaveBeenCalledWith({ where: { id: 'graph-1' } });
    });

    it('throws NotFoundException when the graph is not owned by the user', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-2', 'graph-1')).rejects.toThrow(NotFoundException);
      expect(prisma.client.savedGraph.delete).not.toHaveBeenCalled();
    });
  });
});
