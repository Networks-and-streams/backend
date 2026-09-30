import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
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
}
