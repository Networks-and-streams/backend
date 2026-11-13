import { Test, TestingModule } from '@nestjs/testing';

import { SavedGraphsController } from './saved-graphs.controller';
import { SavedGraphsService } from './saved-graphs.service';
import { SavedGraphsMapper } from './saved-graphs.mapper';

describe('SavedGraphsController', () => {
  let controller: SavedGraphsController;

  const user = { id: 'user-1', email: 'u@example.com', sid: 'sid-1' };

  const row = {
    id: 'g-1',
    userId: 'user-1',
    name: 'Lab 3',
    graph: { vertices: 2, source: 1, edges: [{ from: 1, to: 2, weight: 5 }] },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  const mockService = {
    findAllByUser: jest.fn(),
    findOneForUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedGraphsController],
      providers: [
        { provide: SavedGraphsService, useValue: mockService },
        { provide: SavedGraphsMapper, useValue: new SavedGraphsMapper() },
      ],
    }).compile();

    controller = module.get(SavedGraphsController);
    jest.clearAllMocks();
  });

  it('GET /graphs maps the list for the current user', async () => {
    mockService.findAllByUser.mockResolvedValue([row]);

    const result = await controller.list(user);

    expect(mockService.findAllByUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      {
        id: 'g-1',
        name: 'Lab 3',
        graph: row.graph,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    ]);
  });

  it('GET /graphs/:id returns the mapped row', async () => {
    mockService.findOneForUser.mockResolvedValue(row);
    const result = await controller.getOne(user, 'g-1');
    expect(mockService.findOneForUser).toHaveBeenCalledWith('g-1', 'user-1');
    expect(result.id).toBe('g-1');
  });

  it('POST /graphs creates and maps', async () => {
    mockService.create.mockResolvedValue(row);
    const dto = { name: 'Lab 3', graph: row.graph };

    const result = await controller.create(user, dto as never);

    expect(mockService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toMatchObject({ id: 'g-1', name: 'Lab 3' });
  });

  it('PATCH /graphs/:id passes user ownership through', async () => {
    mockService.update.mockResolvedValue({ ...row, name: 'renamed' });
    const result = await controller.update(user, 'g-1', { name: 'renamed' });
    expect(mockService.update).toHaveBeenCalledWith('g-1', 'user-1', { name: 'renamed' });
    expect(result.name).toBe('renamed');
  });

  it('DELETE /graphs/:id returns nothing (204 contract)', async () => {
    mockService.remove.mockResolvedValue(undefined);
    const result = await controller.remove(user, 'g-1');
    expect(mockService.remove).toHaveBeenCalledWith('g-1', 'user-1');
    expect(result).toBeUndefined();
  });
});
