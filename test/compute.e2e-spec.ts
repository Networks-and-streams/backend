import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { INestApplication } from '@nestjs/common';

import { E2EUser, bearer, createTestApp, http, registerUser, uniqueEmail } from './app.helper';

/** Absolute path of the compute proto (lives in the sibling compute repo). */
const PROTO_PATH = path.resolve(__dirname, '../../compute/proto/compute.proto');

type ExecuteHandler = (
  call: { request: Record<string, unknown> },
  callback: (err: Error | null, response?: Record<string, unknown>) => void,
) => void;

/** Starts a real in-process compute server exposing `Execute(handler)`. */
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
        const force = setTimeout(() => {
          server.forceShutdown();
          resolve();
        }, 200);
        server.tryShutdown(() => {
          clearTimeout(force);
          resolve();
        });
      }),
  };
}

/** A hand-checked result: max-flow 9 == min-cut 9 on the sample network. */
const flowResult = {
  algorithm: 'ford_fulkerson',
  mode: 'dfs',
  max_flow: 9,
  source: 1,
  sink: 4,
  flows: [
    { index: 0, from: 1, to: 2, flow: 5, capacity: 5 },
    { index: 1, from: 1, to: 3, flow: 4, capacity: 4 },
    { index: 2, from: 2, to: 3, flow: 1, capacity: 3 },
    { index: 3, from: 2, to: 4, flow: 4, capacity: 4 },
    { index: 4, from: 3, to: 4, flow: 5, capacity: 5 },
  ],
  min_cut: {
    value: 9,
    source_side: [1],
    sink_side: [2, 3, 4],
    edges: [
      { index: 0, from: 1, to: 2, capacity: 5 },
      { index: 1, from: 1, to: 3, capacity: 4 },
    ],
  },
};

/** The execution trace the frontend animates (3 augmentations + final frame). */
const flowSteps = [
  { iteration: 1, augmenting_path: [1, 2, 4], bottleneck: 4, flows: [], max_flow_so_far: 4 },
  { iteration: 2, augmenting_path: [1, 3, 4], bottleneck: 4, flows: [], max_flow_so_far: 8 },
  { iteration: 3, augmenting_path: [1, 2, 3, 4], bottleneck: 1, flows: [], max_flow_so_far: 9 },
  {
    iteration: 4,
    augmenting_path: [],
    bottleneck: 0,
    flows: flowResult.flows.map(({ index, from, to, flow }) => ({ index, from, to, flow })),
    max_flow_so_far: 9,
    min_cut: flowResult.min_cut,
  },
];

/** Sample network used by every request body (1-based, 5 edges). */
const computeBody = {
  algorithm: 'ford_fulkerson',
  graph: {
    vertices: 4,
    edges: [
      { from: 1, to: 2, weight: 5 },
      { from: 1, to: 3, weight: 4 },
      { from: 2, to: 3, weight: 3 },
      { from: 2, to: 4, weight: 4 },
      { from: 3, to: 4, weight: 5 },
    ],
    source: 1,
  },
  sink: 4,
};

/**
 * End-to-end coverage of `POST /graph/compute` (expansion plan §2.4).
 *
 * The Rust compute service is replaced by a real in-process gRPC server
 * (`jest.mock` cannot hoist through @swc/jest), so every status mapping —
 * 200 / 400 / 422 / 500 / 503 — is exercised through the actual client.
 */
describe('POST /graph/compute (e2e)', () => {
  let app: INestApplication;
  let user: E2EUser;
  let stop: (() => Promise<void>) | undefined;

  /** The behaviour the mock gRPC server exposes for the current test. */
  let handler: ExecuteHandler;
  /** Every request the backend forwarded to compute. */
  const seen: Record<string, unknown>[] = [];

  beforeAll(async () => {
    const server = await startServer((call, callback) => handler(call, callback));
    stop = server.stop;

    app = await createTestApp({ computeAddr: `127.0.0.1:${server.port}` });
    user = await registerUser(app, uniqueEmail('compute'));
  });

  afterAll(async () => {
    await app.close();
    await stop?.();
  });

  beforeEach(() => {
    seen.length = 0;
    handler = (call, callback) => {
      seen.push(call.request);
      callback(null, {
        status: 'ok',
        result_json: JSON.stringify(flowResult),
        steps_json: JSON.stringify(flowSteps),
        error: '',
      });
    };
  });

  it('returns the parsed result and trace → 200', async () => {
    const res = await http(app).post('/graph/compute').set(bearer(user.accessToken)).send(computeBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      algorithm: 'ford_fulkerson',
      result: flowResult,
      steps: flowSteps,
    });

    // The max-flow min-cut theorem, asserted on the wire payload.
    expect(res.body.result.max_flow).toBe(res.body.result.min_cut.value);
    expect(res.body.steps).toHaveLength(4);
  });

  it('forwards sink and the include_steps default to compute', async () => {
    await http(app).post('/graph/compute').set(bearer(user.accessToken)).send(computeBody);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ algorithm: 'ford_fulkerson', sink: 4, include_steps: true });
    expect((seen[0].graph as { source: number }).source).toBe(1);
    expect((seen[0].graph as { edges: unknown[] }).edges).toHaveLength(5);
  });

  it('honours include_steps=false → 200 with an empty trace', async () => {
    handler = (call, callback) => {
      seen.push(call.request);
      callback(null, { status: 'ok', result_json: JSON.stringify(flowResult), steps_json: '[]', error: '' });
    };

    const res = await http(app)
      .post('/graph/compute')
      .set(bearer(user.accessToken))
      .send({ ...computeBody, include_steps: false });

    expect(res.status).toBe(200);
    expect(res.body.steps).toEqual([]);
    expect(seen[0]).toMatchObject({ include_steps: false });
  });

  it('rejects a flow algorithm without a sink → 400 before calling compute', async () => {
    const { sink: _sink, ...withoutSink } = computeBody;
    const res = await http(app).post('/graph/compute').set(bearer(user.accessToken)).send(withoutSink);

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toContain('requires a sink');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(seen).toHaveLength(0);
  });

  it('rejects an out-of-range graph → 400 with a cross-field error list', async () => {
    const res = await http(app)
      .post('/graph/compute')
      .set(bearer(user.accessToken))
      .send({ ...computeBody, graph: { ...computeBody.graph, edges: [{ from: 99, to: 1, weight: 5 }] } });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.join(' ')).toContain('edges[0].from');
    expect(seen).toHaveLength(0);
  });

  it('rejects an unknown algorithm at the validation pipe → 400', async () => {
    const res = await http(app)
      .post('/graph/compute')
      .set(bearer(user.accessToken))
      .send({ ...computeBody, algorithm: 'dijkstra' });

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(seen).toHaveLength(0);
  });

  it('maps a compute-side validation failure → 400', async () => {
    handler = (_call, callback) =>
      callback(null, { status: 'InvalidGraph', result_json: '', steps_json: '', error: 'sink 9 not in graph' });

    const res = await http(app).post('/graph/compute').set(bearer(user.accessToken)).send(computeBody);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('InvalidGraph');
    expect(res.body.errors).toEqual(['sink 9 not in graph']);
  });

  it('maps AlgorithmExecutionError → 422', async () => {
    handler = (_call, callback) =>
      callback(null, { status: 'AlgorithmExecutionError', result_json: '', steps_json: '', error: 'cycle detected' });

    const res = await http(app).post('/graph/compute').set(bearer(user.accessToken)).send(computeBody);

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Algorithm execution failed');
    expect(res.body.errors).toEqual(['cycle detected']);
  });

  it('maps broken result JSON → 500', async () => {
    handler = (_call, callback) =>
      callback(null, { status: 'ok', result_json: '{not json', steps_json: '[]', error: '' });

    const res = await http(app).post('/graph/compute').set(bearer(user.accessToken)).send(computeBody);

    expect(res.status).toBe(500);
    expect(res.body.statusCode).toBe(500);
    expect(String(res.body.message)).toContain('invalid result JSON');
  });

  it('maps an unknown compute status → 500', async () => {
    handler = (_call, callback) =>
      callback(null, { status: 'TotallyUnexpected', result_json: '{}', steps_json: '[]', error: '' });

    const res = await http(app).post('/graph/compute').set(bearer(user.accessToken)).send(computeBody);

    expect(res.status).toBe(500);
    expect(String(res.body.message)).toContain('unknown status');
  });

  it('maps an unreachable compute service → 503', async () => {
    // Nothing listens on port 1, so the channel fails immediately.
    const deadApp = await createTestApp({ computeAddr: '127.0.0.1:1' });

    try {
      const res = await http(deadApp).post('/graph/compute').set(bearer(user.accessToken)).send(computeBody);

      expect(res.status).toBe(503);
      expect(res.body.statusCode).toBe(503);
      expect(res.body.message).toBe('Compute service unavailable');
    } finally {
      await deadApp.close();
    }
  }, 20_000);
});
