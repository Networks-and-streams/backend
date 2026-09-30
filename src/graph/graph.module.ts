// src/graph/graph.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';

/**
 * Compute connectivity.
 *
 * Inside Docker Compose the backend reaches the compute container over the
 * Docker DNS service name (`compute:50051`), which is set via COMPUTE_URL in
 * the compose files. The gRPC proto file lives in `compute/proto/` (outside the
 * backend source tree); Compose bakes it into the image at `/proto/compute.proto`
 * (see backend/Dockerfile + build.additional_contexts). Both defaults keep the
 * plain host workflow (backend run locally against a locally-running compute)
 * working: `localhost:50051` and `../compute/proto/compute.proto`.
 */
const computeUrl = process.env.COMPUTE_URL ?? 'localhost:50051';
const computeProtoPath =
  process.env.COMPUTE_PROTO_PATH ?? join(process.cwd(), '../compute/proto/compute.proto');

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'COMPUTE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'compute',
          protoPath: computeProtoPath,
          url: computeUrl,
        },
      },
    ]),
  ],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule { }
