import { Module } from '@nestjs/common';

import { SavedGraphsController } from './saved-graphs.controller';
import { SavedGraphsMapper } from './saved-graphs.mapper';
import { SavedGraphsService } from './saved-graphs.service';

@Module({
  controllers: [SavedGraphsController],
  providers: [SavedGraphsService, SavedGraphsMapper],
  exports: [SavedGraphsService],
})
export class SavedGraphsModule {}
