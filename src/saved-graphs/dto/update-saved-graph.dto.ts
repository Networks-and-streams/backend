import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SavedGraphDataDto } from './saved-graph-data.dto';

export class UpdateSavedGraphDto {
  @ApiPropertyOptional({ example: 'Dijkstra test graph', description: 'Human-readable name of the saved graph' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    type: SavedGraphDataDto,
    description: 'Reusable graph definition (same format as the compute endpoint)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedGraphDataDto)
  graph?: SavedGraphDataDto;
}
