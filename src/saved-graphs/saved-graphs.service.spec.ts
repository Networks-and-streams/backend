import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaContextService } from '@/core/prisma';
import { SavedGraphsService } from './saved-graphs.service';
import type { CreateSavedGraphDto, UpdateSavedGraphDto } from './dto/saved-graph.dto';

const validGraph = {
  vertices: 4,
  source: 1,
  edges: [
    { from: 1, to: 2, weight: 5 },
    { from: 2, to: 4, weight: 7 },
  ],
};

function createMockPrismaContext() {
  return {
    client: {
      savedGraph: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    },
    transaction: (fn: () => Promise<unknown>) => fn(),
  };
}

describe('SavedGraphsService', () => {
  let service: SavedGraphsService;
  let prisma: ReturnType<typeof createMockPrismaContext>;

  const row = {
    id: 'g-1',
    userId: 'user-1',
    name: 'Lab 3',
    graph: validGraph,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  beforeEach(async () => {
    prisma = createMockPrismaContext();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SavedGraphsService, { provide: PrismaContextService, useValue: prisma }],
    }).compile();
    service = module.get(SavedGraphsService);
  });

  describe('findAllByUser', () => {
    it('lists only the user graphs sorted by updatedAt desc', async () => {
      prisma.client.savedGraph.findMany.mockResolvedValue([row]);

      const result = await service.findAllByUser('user-1');

      expect(prisma.client.savedGraph.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual([row]);
    });
  });

  describe('findOneForUser', () => {
    it('returns the owned graph', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(row);
      const result = await service.findOneForUser('g-1', 'user-1');
      expect(result).toEqual(row);
      expect(prisma.client.savedGraph.findFirst).toHaveBeenCalledWith({
        where: { id: 'g-1', userId: 'user-1' },
      });
    });

    it("throws 404 for someone else's graph", async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(null);
      await expect(service.findOneForUser('g-1', 'other-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('persists a valid graph for the user', async () => {
      prisma.client.savedGraph.create.mockResolvedValue(row);
      const dto: CreateSavedGraphDto = { name: 'Lab 3', graph: validGraph };

      const result = await service.create('user-1', dto);

      expect(prisma.client.savedGraph.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'Lab 3', graph: validGraph },
      });
      expect(result).toEqual(row);
    });

    it('rejects a graph whose edge escapes vertices', async () => {
      const bad: CreateSavedGraphDto = {
        name: 'bad',
        graph: { ...validGraph, edges: [{ from: 1, to: 9, weight: 1 }] },
      };
      await expect(service.create('user-1', bad)).rejects.toThrow(BadRequestException);
      expect(prisma.client.savedGraph.create).not.toHaveBeenCalled();
    });

    it('rejects source out of range', async () => {
      const bad: CreateSavedGraphDto = { name: 'bad', graph: { ...validGraph, source: 5 } };
      await expect(service.create('user-1', bad)).rejects.toThrow(BadRequestException);
    });

    it('rejects negative weight', async () => {
      const bad: CreateSavedGraphDto = {
        name: 'bad',
        graph: { ...validGraph, edges: [{ from: 1, to: 2, weight: -1 }] },
      };
      await expect(service.create('user-1', bad)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('404s for a foreign graph before touching it', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(null);
      const dto: UpdateSavedGraphDto = { name: 'renamed' };
      await expect(service.update('g-1', 'other', dto)).rejects.toThrow(NotFoundException);
      expect(prisma.client.savedGraph.update).not.toHaveBeenCalled();
    });

    it('updates only provided fields', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(row);
      prisma.client.savedGraph.update.mockResolvedValue({ ...row, name: 'renamed' });

      await service.update('g-1', 'user-1', { name: 'renamed' });

      expect(prisma.client.savedGraph.update).toHaveBeenCalledWith({
        where: { id: 'g-1' },
        data: { name: 'renamed' },
      });
    });

    it('validates a new graph payload on update', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(row);
      const dto: UpdateSavedGraphDto = {
        graph: { ...validGraph, edges: [{ from: 1, to: 99, weight: 1 }] },
      };
      await expect(service.update('g-1', 'user-1', dto)).rejects.toThrow(BadRequestException);
      expect(prisma.client.savedGraph.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an owned graph', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(row);
      prisma.client.savedGraph.delete.mockResolvedValue(row);

      await service.remove('g-1', 'user-1');

      expect(prisma.client.savedGraph.delete).toHaveBeenCalledWith({ where: { id: 'g-1' } });
    });

    it('404s for a foreign graph', async () => {
      prisma.client.savedGraph.findFirst.mockResolvedValue(null);
      await expect(service.remove('g-1', 'other')).rejects.toThrow(NotFoundException);
      expect(prisma.client.savedGraph.delete).not.toHaveBeenCalled();
    });
  });
});
