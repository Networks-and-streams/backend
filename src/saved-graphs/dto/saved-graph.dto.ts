import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

import { GraphDto } from '@/graph/dto/graph.dto';

export class CreateSavedGraphDto {
  @ApiProperty({
    description: 'Display name of the saved graph',
    example: 'Lab 3 — max flow',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ type: GraphDto, description: 'Graph payload (same shape as POST /graph/compute)' })
  @ValidateNested()
  @Type(() => GraphDto)
  graph!: GraphDto;
}

export class UpdateSavedGraphDto {
  @ApiPropertyOptional({ description: 'New display name', example: 'Lab 3 — final', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ type: GraphDto, description: 'Replacement graph payload' })
  @IsOptional()
  @ValidateNested()
  @Type(() => GraphDto)
  graph?: GraphDto;
}
