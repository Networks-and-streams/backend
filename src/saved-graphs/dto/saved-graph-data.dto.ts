import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const METRIC_AGGREGATES = ['sum', 'min', 'max'] as const;
export const MAX_METRICS = 8;
export const METRIC_KEY_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
export const MAX_METRIC_VALUE = 1e12;

/** An extra edge parameter defined for the whole graph (throughput, time…). */
export class EdgeMetricDto {
  @ApiProperty({ example: 'm1', description: 'Stable key used in edge `values`' })
  @IsString()
  @Matches(METRIC_KEY_PATTERN)
  key!: string;

  @ApiProperty({ example: 'Throughput' })
  @IsString()
  @Length(1, 40)
  name!: string;

  @ApiProperty({ enum: METRIC_AGGREGATES, description: 'How the parameter combines along a route' })
  @IsIn(METRIC_AGGREGATES)
  aggregate!: (typeof METRIC_AGGREGATES)[number];
}

export class SavedEdgeDto {
  @ApiProperty() @IsNumber() from!: number;
  @ApiProperty() @IsNumber() to!: number;
  @ApiProperty() @IsNumber() weight!: number;

  @ApiPropertyOptional({ example: { m1: 10 }, description: 'Extra parameter values by metric key' })
  @IsOptional()
  @IsObject()
  values?: Record<string, number>;
}

/**
 * Graph as stored in "My Graphs": the compute graph plus optional extra edge
 * parameters. Only `vertices`, `source` and edge `from/to/weight` are sent to
 * the compute service.
 */
export class SavedGraphDataDto {
  @ApiProperty() @IsNumber() vertices!: number;

  @ApiProperty({ type: [SavedEdgeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavedEdgeDto)
  edges!: SavedEdgeDto[];

  @ApiProperty() @IsNumber() source!: number;

  @ApiPropertyOptional({ type: [EdgeMetricDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_METRICS)
  @ValidateNested({ each: true })
  @Type(() => EdgeMetricDto)
  metrics?: EdgeMetricDto[];
}
