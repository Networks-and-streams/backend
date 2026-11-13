import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

import { COMPUTE_ALGORITHMS } from '../validation/graph.validation';
import { GraphDto } from './graph.dto';

/**
 * Body of `POST /graph/compute`.
 *
 * Wire format matches the frontend call site
 * (`frontend/src/features/graph/api/graph.api.ts`): snake_case
 * `include_steps`, nested `graph`. `sink` is required by the compute
 * contract for ford_fulkerson / edmonds_karp (validated in the service so
 * the error message can name the algorithm).
 */
export class ComputeRequestDto {
  @ApiProperty({ enum: COMPUTE_ALGORITHMS, description: 'Algorithm to execute' })
  @IsIn(COMPUTE_ALGORITHMS)
  algorithm!: string;

  @ApiProperty({ type: GraphDto })
  @ValidateNested()
  @Type(() => GraphDto)
  graph!: GraphDto;

  @ApiPropertyOptional({
    description: 'Include the execution trace for animation',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  // Field initializer: class-transformer does not run @Transform for keys
  // missing in the body, so the default lives here and applies via `new`.
  include_steps?: boolean = true;

  @ApiPropertyOptional({
    description: 'Sink vertex (1-based). Required for ford_fulkerson / edmonds_karp.',
    example: 4,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sink?: number;
}
