import { Test, TestingModule } from '@nestjs/testing';
import { SavedGraphsController } from './saved-graphs.controller';
import { SavedGraphsService } from './saved-graphs.service';
import { SavedGraphsMapper } from './saved-graphs.mapper';

describe('SavedGraphsController', () => {
  let controller: SavedGraphsController;
  let service: {
    create: jest.Mock;
    findAllByUser: jest.Mock;
    findOwnedByIdOrThrow: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let mapper: { toResponse: jest.Mock; toResponses: jest.Mock };

  const user = { id: 'user-1', email: 'user@example.com', sid: 'sid-1' };
  const record = {
    id: 'graph-1',
    userId: 'user-1',
    name: 'Dijkstra test graph',
    graph: { vertices: 4, source: 1, edges: [{ from: 1, to: 2, weight: 5 }] },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  const createDto = { name: 'Dijkstra test graph', graph: record.graph };
  const updateDto = { name: 'Renamed' };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findOwnedByIdOrThrow: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    mapper = {
      toResponse: jest.fn(),
      toResponses: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedGraphsController],
      providers: [
        { provide: SavedGraphsService, useValue: service },
        { provide: SavedGraphsMapper, useValue: mapper },
      ],
    }).compile();

    controller = module.get<SavedGraphsController>(SavedGraphsController);
    jest.clearAllMocks();
  });

  it('creates a graph with the owner derived from the authenticated user', async () => {
    service.create.mockResolvedValue(record);
    mapper.toResponse.mockReturnValue(record);

    const result = await controller.create(user, createDto);

    expect(service.create).toHaveBeenCalledWith('user-1', createDto);
    expect(mapper.toResponse).toHaveBeenCalledWith(record);
    expect(result).toEqual(record);
  });

  it('lists the authenticated user saved graphs', async () => {
    service.findAllByUser.mockResolvedValue([record]);
    mapper.toResponses.mockReturnValue([record]);

    const result = await controller.findAll(user);

    expect(service.findAllByUser).toHaveBeenCalledWith('user-1');
    expect(mapper.toResponses).toHaveBeenCalledWith([record]);
    expect(result).toEqual([record]);
  });

  it('returns one saved graph for the authenticated user', async () => {
    service.findOwnedByIdOrThrow.mockResolvedValue(record);
    mapper.toResponse.mockReturnValue(record);

    const result = await controller.findOne(user, 'graph-1');

    expect(service.findOwnedByIdOrThrow).toHaveBeenCalledWith('user-1', 'graph-1');
    expect(result).toEqual(record);
  });

  it('updates a saved graph for the authenticated user', async () => {
    service.update.mockResolvedValue(record);
    mapper.toResponse.mockReturnValue(record);

    const result = await controller.update(user, 'graph-1', updateDto);

    expect(service.update).toHaveBeenCalledWith('user-1', 'graph-1', updateDto);
    expect(result).toEqual(record);
  });

  it('deletes a saved graph for the authenticated user and returns no content', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove(user, 'graph-1');

    expect(service.remove).toHaveBeenCalledWith('user-1', 'graph-1');
    expect(result).toBeUndefined();
  });
});
