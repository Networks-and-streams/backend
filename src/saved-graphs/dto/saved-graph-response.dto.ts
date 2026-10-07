import { ApiProperty } from '@nestjs/swagger';
import { SavedGraphDataDto } from './saved-graph-data.dto';

export class SavedGraphResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'Unique identifier of the saved graph' })
  id!: string;

  @ApiProperty({ example: 'Dijkstra test graph', description: 'Human-readable name of the saved graph' })
  name!: string;

  @ApiProperty({ type: SavedGraphDataDto, description: 'Reusable graph definition' })
  graph!: SavedGraphDataDto;

  @ApiProperty({
    example: '2026-07-08T13:40:00.000Z',
    description: 'Timestamp when the graph was created',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-07-15T10:00:00.000Z',
    description: 'Timestamp when the graph was last updated',
    format: 'date-time',
  })
  updatedAt!: Date;
}
