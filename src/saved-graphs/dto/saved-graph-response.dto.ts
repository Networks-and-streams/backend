import { ApiProperty } from '@nestjs/swagger';

// Value import (not `import type`): the decorator below reads GraphDto at runtime.
import { GraphDto } from '@/graph/dto/graph.dto';

/** Response shape of every `/graphs` endpoint (mirrors frontend `SavedGraph`). */
export class SavedGraphResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Lab 3 — max flow' })
  name!: string;

  @ApiProperty({ type: GraphDto })
  graph!: GraphDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
