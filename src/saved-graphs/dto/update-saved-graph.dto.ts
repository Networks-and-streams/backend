import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GraphDto } from '@/graph/dto/compute-request.dto';

export class UpdateSavedGraphDto {
  @ApiPropertyOptional({ example: 'Dijkstra test graph', description: 'Human-readable name of the saved graph' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    type: GraphDto,
    description: 'Reusable graph definition (same format as the compute endpoint)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GraphDto)
  graph?: GraphDto;
}
