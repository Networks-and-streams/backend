import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Max, Min, ValidateNested } from 'class-validator';

import { MAX_EDGES, MAX_VERTICES, MAX_WEIGHT, MIN_WEIGHT } from '../validation/graph.validation';

export class EdgeDto {
  @ApiProperty({ description: 'Source vertex of the edge (1-based)', example: 1, minimum: 1 })
  @IsInt()
  @Type(() => Number)
  from!: number;

  @ApiProperty({ description: 'Target vertex of the edge (1-based)', example: 2, minimum: 1 })
  @IsInt()
  @Type(() => Number)
  to!: number;

  @ApiProperty({
    description: 'Edge weight (minty) / capacity (flow algorithms), non-negative integer',
    example: 5,
    minimum: MIN_WEIGHT,
    maximum: MAX_WEIGHT,
  })
  @IsInt()
  @Min(MIN_WEIGHT)
  @Max(MAX_WEIGHT)
  @Type(() => Number)
  weight!: number;
}

export class GraphDto {
  @ApiProperty({ description: 'Number of vertices (1-based ids)', example: 4, minimum: 1, maximum: MAX_VERTICES })
  @IsInt()
  @Min(1)
  @Max(MAX_VERTICES)
  @Type(() => Number)
  vertices!: number;

  @ApiProperty({ type: [EdgeDto], description: 'Directed edges with integer weights/capacities' })
  @IsArray()
  @ArrayMaxSize(MAX_EDGES)
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges!: EdgeDto[];

  @ApiProperty({ description: 'Source vertex (1-based)', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  source!: number;
}
