import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import path from 'node:path';

const computeEnvSchema = z.object({
  // host:port of the compute gRPC service (inside Docker: compute:50051).
  COMPUTE_ADDR: z.string().min(1).default('localhost:50051'),
  // Per-request deadline; exceeding it maps to HTTP 503.
  COMPUTE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  // Path to compute.proto. The backend repo does not contain the proto file
  // (it lives in the compute repo), so the path MUST be configurable —
  // it differs between local dev and Docker.
  COMPUTE_PROTO_PATH: z.string().min(1).default(path.resolve(process.cwd(), '../compute/proto/compute.proto')),
});

export default registerAs('compute', () => {
  const env = computeEnvSchema.parse(process.env);

  return {
    addr: env.COMPUTE_ADDR,
    timeoutMs: env.COMPUTE_TIMEOUT_MS,
    protoPath: env.COMPUTE_PROTO_PATH,
  };
});
