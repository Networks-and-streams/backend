import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { PackageDefinition } from '@grpc/proto-loader';

import computeConfig from '@/config/loaders/compute.config';
import type { ComputeGrpcResponse } from './compute.types';

/** Request shape sent to compute (proto field names, snake_case). */
export interface ComputeGrpcRequest {
  algorithm: string;
  graph: { vertices: number; edges: { from: number; to: number; weight: number }[]; source: number };
  include_steps: boolean;
  target?: number | null;
  sink?: number | null;
}

/** Raised when the compute service cannot be reached or misses the deadline. */
export class ComputeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComputeUnavailableError';
  }
}

type ComputeClient = grpc.Client & {
  execute(
    request: ComputeGrpcRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: (err: grpc.ServiceError | null, response?: ComputeGrpcResponse) => void,
  ): grpc.ClientUnaryCall;
};

/**
 * Thin async wrapper around the compute gRPC client.
 *
 * - the proto file lives in the *compute* repository, so its location comes
 *   from `COMPUTE_PROTO_PATH` (differs between local dev and Docker);
 * - the channel is created lazily on first use and closed on shutdown;
 * - transport failures (unreachable host, deadline) are normalized to
 *   {@link ComputeUnavailableError} so the service layer can map them to 503
 *   without leaking grpc-js internals.
 */
@Injectable()
export class ComputeClientService implements OnModuleDestroy {
  private readonly logger = new Logger(ComputeClientService.name);
  private client: ComputeClient | null = null;
  private packageDef: PackageDefinition | null = null;

  constructor(
    @Inject(computeConfig.KEY)
    private readonly config: ConfigType<typeof computeConfig>,
  ) {}

  async execute(request: ComputeGrpcRequest): Promise<ComputeGrpcResponse> {
    const client = this.getClient();
    const deadline = new Date(Date.now() + this.config.timeoutMs);

    return new Promise<ComputeGrpcResponse>((resolve, reject) => {
      client.execute(request, new grpc.Metadata(), { deadline }, (err, response) => {
        if (err) {
          // DEADLINE_EXCEEDED / UNAVAILABLE and friends → one 503 signal.
          this.logger.warn(`compute gRPC error: ${err.code} ${err.message}`);
          reject(new ComputeUnavailableError(`Compute service error: ${err.message}`));
          return;
        }
        if (!response) {
          reject(new ComputeUnavailableError('Compute service returned an empty response'));
          return;
        }
        resolve(response);
      });
    });
  }

  /** Closes the gRPC channel (Nest lifecycle hook). */
  onModuleDestroy(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  private getClient(): ComputeClient {
    if (this.client) return this.client;

    const definition = this.loadProto();
    const pkg = grpc.loadPackageDefinition(definition) as unknown as {
      compute: {
        ComputeService: new (
          address: string,
          credentials: grpc.ChannelCredentials,
          options?: grpc.ChannelOptions,
        ) => ComputeClient;
      };
    };

    this.client = new pkg.compute.ComputeService(
      this.config.addr,
      grpc.credentials.createInsecure(),
      // Fail fast instead of hanging when compute is down.
      { 'grpc.keepalive_time_ms': 30_000 },
    );
    this.logger.log(`gRPC client ready (addr=${this.config.addr})`);
    return this.client;
  }

  private loadProto(): PackageDefinition {
    if (this.packageDef) return this.packageDef;
    this.packageDef = protoLoader.loadSync(this.config.protoPath, {
      // Keep proto field names as-is: the wrapper types use the snake_case
      // wire names (include_steps, result_json, steps_json).
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    return this.packageDef;
  }
}
