import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtUser } from '@/common/types/jwt-payload.type';
import { SavedGraphsService } from './saved-graphs.service';
import { SavedGraphsMapper } from './saved-graphs.mapper';
import { CreateSavedGraphDto } from './dto/create-saved-graph.dto';
import { UpdateSavedGraphDto } from './dto/update-saved-graph.dto';
import { SavedGraphResponseDto } from './dto/saved-graph-response.dto';

@ApiTags('Saved Graphs')
@ApiBearerAuth('JWT-auth')
@Controller('graphs')
export class SavedGraphsController {
  constructor(
    private readonly savedGraphsService: SavedGraphsService,
    private readonly savedGraphsMapper: SavedGraphsMapper,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a saved graph',
    description: 'Persists a reusable graph definition for the authenticated user.',
  })
  @ApiCreatedResponse({ type: SavedGraphResponseDto, description: 'Graph saved successfully' })
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateSavedGraphDto) {
    const graph = await this.savedGraphsService.create(user.id, dto);
    return this.savedGraphsMapper.toResponse(graph);
  }

  @Get()
  @ApiOperation({
    summary: 'List saved graphs',
    description: 'Returns all graphs saved by the authenticated user, most recently updated first.',
  })
  @ApiOkResponse({ type: [SavedGraphResponseDto], description: 'Saved graphs returned successfully' })
  async findAll(@CurrentUser() user: JwtUser) {
    const graphs = await this.savedGraphsService.findAllByUser(user.id);
    return this.savedGraphsMapper.toResponses(graphs);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one saved graph',
    description: 'Returns a single saved graph owned by the authenticated user.',
  })
  @ApiOkResponse({ type: SavedGraphResponseDto, description: 'Saved graph returned successfully' })
  @ApiNotFoundResponse({ description: 'Saved graph was not found or does not belong to the user' })
  async findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const graph = await this.savedGraphsService.findOwnedByIdOrThrow(user.id, id);
    return this.savedGraphsMapper.toResponse(graph);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a saved graph',
    description: 'Updates the name and/or graph data of a saved graph owned by the authenticated user.',
  })
  @ApiOkResponse({ type: SavedGraphResponseDto, description: 'Saved graph updated successfully' })
  @ApiNotFoundResponse({ description: 'Saved graph was not found or does not belong to the user' })
  async update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateSavedGraphDto) {
    const graph = await this.savedGraphsService.update(user.id, id, dto);
    return this.savedGraphsMapper.toResponse(graph);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a saved graph',
    description: 'Deletes a saved graph owned by the authenticated user.',
  })
  @ApiNoContentResponse({ description: 'Saved graph deleted successfully' })
  @ApiNotFoundResponse({ description: 'Saved graph was not found or does not belong to the user' })
  async remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    await this.savedGraphsService.remove(user.id, id);
  }
}
