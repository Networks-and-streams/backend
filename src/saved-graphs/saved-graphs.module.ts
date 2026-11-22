import { Module } from '@nestjs/common';
import { SavedGraphsController } from './saved-graphs.controller';
import { SavedGraphsService } from './saved-graphs.service';
import { SavedGraphsMapper } from './saved-graphs.mapper';

@Module({
  controllers: [SavedGraphsController],
  providers: [SavedGraphsService, SavedGraphsMapper],
})
export class SavedGraphsModule {}
