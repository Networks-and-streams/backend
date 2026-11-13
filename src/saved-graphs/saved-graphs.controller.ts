import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtUser } from '@/common/types/jwt-payload.type';

import { SavedGraphsMapper } from './saved-graphs.mapper';
import { SavedGraphsService } from './saved-graphs.service';
import { CreateSavedGraphDto, UpdateSavedGraphDto } from './dto/saved-graph.dto';
import { SavedGraphResponseDto } from './dto/saved-graph-response.dto';

@ApiTags('Graphs')
@ApiBearerAuth('JWT-auth')
@Controller('graphs')
export class SavedGraphsController {
  constructor(
    private readonly savedGraphsService: SavedGraphsService,
    private readonly savedGraphsMapper: SavedGraphsMapper,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List current user saved graphs',
    description:
      'Returns every graph saved by the authenticated user, newest update first. ' +
      'Each entry carries the complete graph definition so no follow-up request is needed.',
  })
  @ApiOkResponse({ type: [SavedGraphResponseDto], description: 'List of saved graphs' })
  async list(@CurrentUser() user: JwtUser): Promise<SavedGraphResponseDto[]> {
    const graphs = await this.savedGraphsService.findAllByUser(user.id);
    return this.savedGraphsMapper.toResponses(graphs);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one saved graph by id', description: '404 for foreign or missing ids.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SavedGraphResponseDto })
  @ApiNotFoundResponse({ description: 'Saved graph not found' })
  async getOne(@CurrentUser() user: JwtUser, @Param('id') id: string): Promise<SavedGraphResponseDto> {
    const graph = await this.savedGraphsService.findOneForUser(id, user.id);
    return this.savedGraphsMapper.toResponse(graph);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a saved graph',
    description: 'Validates the graph payload before persisting (1-based vertices, non-negative integer weights).',
  })
  @ApiCreatedResponse({ type: SavedGraphResponseDto, description: 'Created saved graph' })
  @ApiBadRequestResponse({ description: 'Invalid graph payload or name' })
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateSavedGraphDto): Promise<SavedGraphResponseDto> {
    const graph = await this.savedGraphsService.create(user.id, dto);
    return this.savedGraphsMapper.toResponse(graph);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved graph name and/or payload' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SavedGraphResponseDto })
  @ApiNotFoundResponse({ description: 'Saved graph not found' })
  @ApiBadRequestResponse({ description: 'Invalid graph payload or name' })
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateSavedGraphDto,
  ): Promise<SavedGraphResponseDto> {
    const graph = await this.savedGraphsService.update(id, user.id, dto);
    return this.savedGraphsMapper.toResponse(graph);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a saved graph' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Saved graph not found' })
  async remove(@CurrentUser() user: JwtUser, @Param('id') id: string): Promise<void> {
    await this.savedGraphsService.remove(id, user.id);
  }
}
