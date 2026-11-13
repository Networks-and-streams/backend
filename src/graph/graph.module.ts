import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import computeConfig from '@/config/loaders/compute.config';

import { ComputeClientService } from './grpc/compute-client.service';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';

@Module({
  imports: [ConfigModule.forFeature(computeConfig)],
  controllers: [GraphController],
  providers: [GraphService, ComputeClientService],
  exports: [GraphService],
})
export class GraphModule {}
