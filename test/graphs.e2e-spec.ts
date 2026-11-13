import { INestApplication } from '@nestjs/common';

import { E2EUser, bearer, createTestApp, http, registerUser, uniqueEmail } from './app.helper';

/**
 * CRUD coverage of `/graphs` (expansion plan §2.4): create, list, read,
 * update, delete, ownership isolation (404 for foreign ids) and the two
 * validation layers (class-validator pipe vs. cross-field graph checks).
 */
describe('Saved graphs API (e2e)', () => {
  let app: INestApplication;
  let owner: E2EUser;
  let stranger: E2EUser;

  const graph = {
    vertices: 4,
    edges: [
      { from: 1, to: 2, weight: 5 },
      { from: 2, to: 4, weight: 3 },
    ],
    source: 1,
  };

  let createdId: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await registerUser(app, uniqueEmail('graphs-owner'));
    stranger = await registerUser(app, uniqueEmail('graphs-stranger'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication → 401', async () => {
    const res = await http(app).get('/graphs');

    expect(res.status).toBe(401);
  });

  it('POST /graphs → 201 echoing the persisted payload', async () => {
    const res = await http(app)
      .post('/graphs')
      .set(bearer(owner.accessToken))
      .send({ name: 'Lab 3 — max flow', graph });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.name).toBe('Lab 3 — max flow');
    expect(res.body.graph).toEqual(graph);
    expect(typeof res.body.createdAt).toBe('string');

    createdId = res.body.id;
  });

  it('GET /graphs → 200 listing only the caller graphs', async () => {
    const res = await http(app).get('/graphs').set(bearer(owner.accessToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const mine = res.body.filter((entry: { id: string }) => entry.id === createdId);
    expect(mine).toHaveLength(1);
    expect(mine[0].graph).toEqual(graph);
  });

  it('GET /graphs/:id → 200 with the full graph definition', async () => {
    const res = await http(app).get(`/graphs/${createdId}`).set(bearer(owner.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
    expect(res.body.graph.vertices).toBe(4);
    expect(res.body.graph.source).toBe(1);
  });

  it('PATCH /graphs/:id → 200 with updated fields', async () => {
    const renamed = { ...graph, edges: [...graph.edges, { from: 3, to: 4, weight: 7 }] };

    const res = await http(app)
      .patch(`/graphs/${createdId}`)
      .set(bearer(owner.accessToken))
      .send({ name: 'Lab 3 — final', graph: renamed });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Lab 3 — final');
    expect(res.body.graph.edges).toHaveLength(3);
  });

  it('rejects an out-of-range graph → 400 with a cross-field error list', async () => {
    const res = await http(app)
      .post('/graphs')
      .set(bearer(owner.accessToken))
      .send({
        name: 'broken',
        graph: { vertices: 4, edges: [{ from: 99, to: 1, weight: 5 }], source: 1 },
      });

    expect(res.status).toBe(400);
    expect(typeof res.body.message).toBe('string');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.join(' ')).toContain('edges[0].from');
  });

  it('rejects an empty name at the validation pipe → 400', async () => {
    const res = await http(app).post('/graphs').set(bearer(owner.accessToken)).send({ name: '', graph });

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('hides the owner graph from other users → 404 on read, update and delete', async () => {
    const read = await http(app).get(`/graphs/${createdId}`).set(bearer(stranger.accessToken));
    expect(read.status).toBe(404);

    const update = await http(app)
      .patch(`/graphs/${createdId}`)
      .set(bearer(stranger.accessToken))
      .send({ name: 'stolen' });
    expect(update.status).toBe(404);

    const remove = await http(app).delete(`/graphs/${createdId}`).set(bearer(stranger.accessToken));
    expect(remove.status).toBe(404);

    // The graph is still there for its owner.
    const stillOwned = await http(app).get(`/graphs/${createdId}`).set(bearer(owner.accessToken));
    expect(stillOwned.status).toBe(200);
    expect(stillOwned.body.name).toBe('Lab 3 — final');
  });

  it('DELETE /graphs/:id → 204, then the graph is gone → 404', async () => {
    const res = await http(app).delete(`/graphs/${createdId}`).set(bearer(owner.accessToken));

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const gone = await http(app).get(`/graphs/${createdId}`).set(bearer(owner.accessToken));
    expect(gone.status).toBe(404);

    const list = await http(app).get('/graphs').set(bearer(owner.accessToken));
    expect(list.body.find((entry: { id: string }) => entry.id === createdId)).toBeUndefined();
  });
});
