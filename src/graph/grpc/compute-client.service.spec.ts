import path from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigType } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

import computeConfig from '@/config/loaders/compute.config';
import { ComputeClientService, ComputeUnavailableError } from './compute-client.service';

/** Absolute path of the compute proto (lives in the sibling compute repo). */
const PROTO_PATH = path.resolve(__dirname, '../../../../compute/proto/compute.proto');

type ExecuteHandler = (
  call: { request: Record<string, unknown> },
  callback: (err: Error | null, response?: Record<string, unknown>) => void,
) => void;

/** Starts a real in-process compute server exposing Execute(handler). */
async function startServer(handler: ExecuteHandler): Promise<{ port: number; stop: () => Promise<void> }> {
  const definition = protoLoader.loadSync(PROTO_PATH, { keepCase: true, defaults: true });
  const pkg = grpc.loadPackageDefinition(definition) as unknown as {
    compute: { ComputeService: { service: grpc.ServiceDefinition } };
  };

  const server = new grpc.Server();
  server.addService(pkg.compute.ComputeService.service, { execute: handler });

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) reject(err);
      else resolve(boundPort);
    });
  });

  return {
    port,
    stop: () =>
      new Promise<void>((resolve) => {
        server.tryShutdown(() => resolve());
        setTimeout(() => {
          server.forceShutdown();
          resolve();
        }, 200);
      }),
  };
}

const okResponse = {
  status: 'ok',
  result_json: '{"max_flow":5}',
  steps_json: '[]',
  error: '',
};

const request = {
  algorithm: 'minty',
  graph: { vertices: 2, edges: [{ from: 1, to: 2, weight: 1 }], source: 1 },
  include_steps: false,
};

describe('ComputeClientService (against a real in-process gRPC server)', () => {
  let service: ComputeClientService;
  let stops: Array<() => Promise<void>> = [];

  async function buildService(overrides: Partial<ConfigType<typeof computeConfig>> = {}) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComputeClientService,
        {
          provide: computeConfig.KEY,
          useValue: {
            addr: '127.0.0.1:1',
            timeoutMs: 2000,
            protoPath: PROTO_PATH,
            ...overrides,
          } as ConfigType<typeof computeConfig>,
        },
      ],
    }).compile();
    return module.get(ComputeClientService);
  }

  async function serve(handler: ExecuteHandler) {
    const server = await startServer(handler);
    stops.push(server.stop);
    service = await buildService({ addr: `127.0.0.1:${server.port}` });
    return server;
  }

  beforeEach(() => {
    stops = [];
  });

  afterEach(async () => {
    service?.onModuleDestroy();
    await Promise.all(stops.map((stop) => stop()));
    stops = [];
  });

  it('resolves the raw compute response', async () => {
    const seen: Record<string, unknown>[] = [];
    await serve((call, callback) => {
      seen.push(call.request);
      callback(null, okResponse);
    });

    await expect(service.execute(request)).resolves.toEqual(okResponse);
    // The wrapper forwards the snake_case request unchanged.
    expect(seen[0]).toMatchObject({ algorithm: 'minty', include_steps: false });
    expect((seen[0].graph as { source: number }).source).toBe(1);
  });

  it('reuses one channel across calls', async () => {
    await serve((_call, callback) => callback(null, okResponse));

    await service.execute(request);
    const first = (service as unknown as { client: { close(): void } }).client;
    await service.execute(request);
    expect((service as unknown as { client: unknown }).client).toBe(first);
  });

  it('translates grpc error statuses into ComputeUnavailableError', async () => {
    await serve((_call, callback) => {
      const err = Object.assign(new Error('14 UNAVAILABLE: connection refused'), {
        code: grpc.status.UNAVAILABLE,
      });
      callback(err);
    });

    await expect(service.execute(request)).rejects.toThrow(ComputeUnavailableError);
  });

  it('rejects when compute is unreachable', async () => {
    // Nothing listens on port 1.
    service = await buildService({ addr: '127.0.0.1:1', timeoutMs: 1500 });
    await expect(service.execute(request)).rejects.toThrow(ComputeUnavailableError);
  });

  it('rejects on deadline exceeded', async () => {
    // Server accepts but never answers; the client deadline must fire.
    await serve(() => {
      /* never call the callback */
    });
    const addr = (service as unknown as { config: { addr: string } }).config.addr;
    service.onModuleDestroy();
    service = await buildService({ addr, timeoutMs: 200 });

    await expect(service.execute(request)).rejects.toThrow(ComputeUnavailableError);
  }, 10_000);

  it('closes the channel on shutdown and rebuilds afterwards', async () => {
    await serve((_call, callback) => callback(null, okResponse));

    await service.execute(request);
    const instance = (service as unknown as { client: { close(): void } }).client;
    const closeSpy = jest.spyOn(instance, 'close');

    service.onModuleDestroy();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // A fresh call transparently creates a new channel.
    await expect(service.execute(request)).resolves.toEqual(okResponse);
    expect((service as unknown as { client: unknown }).client).not.toBe(instance);
  });
});
