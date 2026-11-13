/**
 * Types of the compute service JSON payloads (`result_json` / `steps_json`).
 *
 * Source of truth: `compute/src/algorithms/ford_fulkerson/mod.rs` (flow) and
 * `compute/src/algorithms/minty/mod.rs` (shortest paths). The gRPC contract
 * transports these as JSON strings; the backend parses them and forwards the
 * objects verbatim to the frontend.
 */

/** Minty result (`compute` serializes distances/paths with vertex keys). */
export interface MintyResultJson {
  source: number;
  /** Key = vertex id (1-based), value = distance or null when unreachable. */
  distances: Record<string, number | null>;
  /** Key = vertex id, value = list of shortest routes (each route 1-based). */
  paths: Record<string, number[][]>;
  truncated?: boolean;
}

/** One edge of the flow solution; `index` is the position in the input edge list. */
export interface FlowEdgeJson {
  index: number;
  from: number;
  to: number;
  flow: number;
  capacity: number;
}

export interface CutEdgeJson {
  index: number;
  from: number;
  to: number;
  capacity: number;
}

export interface MinCutJson {
  value: number;
  source_side: number[];
  sink_side: number[];
  edges: CutEdgeJson[];
}

/** Ford-Fulkerson / Edmonds-Karp result. */
export interface FordFulkersonResultJson {
  algorithm: 'ford_fulkerson' | 'edmonds_karp';
  mode: 'dfs' | 'bfs';
  max_flow: number;
  source: number;
  sink: number;
  flows: FlowEdgeJson[];
  min_cut: MinCutJson;
}

/** Snapshot of one edge's flow at a given trace step. */
export interface FlowSnapshotJson {
  index: number;
  from: number;
  to: number;
  flow: number;
}

/** One animation frame of the flow execution trace. */
export interface FlowStepJson {
  iteration: number;
  /** Vertices source … sink of this augmentation; empty on the final frame. */
  augmenting_path: number[];
  bottleneck: number;
  flows: FlowSnapshotJson[];
  max_flow_so_far: number;
  /** Present only on the final frame. */
  min_cut?: MinCutJson;
}

/** Minty execution trace step. */
export interface MintyStepJson {
  current: number | null;
  visited: number[];
  distances: Record<string, number | null>;
}

export type ComputeResultJson = MintyResultJson | FordFulkersonResultJson;
export type ComputeStepJson = FlowStepJson | MintyStepJson;

/** Raw `ComputeResponse` fields as they arrive over gRPC. */
export interface ComputeGrpcResponse {
  status: string;
  result_json: string;
  steps_json: string;
  error: string;
}

/** Statuses the compute service can return (mirrors `compute/src/server.rs`). */
export const COMPUTE_OK = 'ok';
export const COMPUTE_CLIENT_ERROR_STATUSES = [
  'InvalidRequest',
  'InvalidGraph',
  'InvalidAlgorithmInput',
  'UnsupportedAlgorithm',
] as const;
export const COMPUTE_EXECUTION_ERROR_STATUS = 'AlgorithmExecutionError';
