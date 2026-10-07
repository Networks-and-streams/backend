import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsArray, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EdgeDto {
  @ApiProperty() @IsNumber() from: number;
  @ApiProperty() @IsNumber() to: number;
  @ApiProperty() @IsNumber() weight: number;
}

export class GraphDto {
  @ApiProperty() @IsNumber() vertices: number;
  @ApiProperty({ type: [EdgeDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => EdgeDto) edges: EdgeDto[];
  @ApiProperty() @IsNumber() source: number;
}

export class ComputeRequestDto {
  @ApiProperty() @IsString() algorithm: string;
  @ApiProperty({ type: GraphDto }) @ValidateNested() @Type(() => GraphDto) graph: GraphDto;
  @ApiProperty() @IsBoolean() include_steps: boolean; // Или includeSteps, в зависимости от того, что ждет gRPC

  @ApiProperty({
    required: false,
    description: 'Minty only: return shortest routes to this vertex only (1-based). Omit for routes to every vertex.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  target?: number;
}
