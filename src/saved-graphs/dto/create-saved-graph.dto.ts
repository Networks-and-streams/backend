import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SavedGraphDataDto } from './saved-graph-data.dto';

export class CreateSavedGraphDto {
  @ApiProperty({ example: 'Dijkstra test graph', description: 'Human-readable name of the saved graph' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    type: SavedGraphDataDto,
    description: 'Reusable graph definition (same format as the compute endpoint)',
  })
  @ValidateNested()
  @Type(() => SavedGraphDataDto)
  graph!: SavedGraphDataDto;
}
