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

/** What a detailed flow trace frame shows (Ford–Fulkerson only). */
export type FlowFrameKindJson = 'label' | 'reverse' | 'augment' | 'final';

/** A vertex's mark at one point of the labeling stage (`null` = ∞). */
export interface VertexMarkJson {
  vertex: number;
  mark: number | null;
}

/** One labeling action: vertex `to` gets its mark from vertex `from`. */
export interface LabelComputationJson {
  from: number;
  to: number;
  /** Mark of `from`; `null` = ∞. */
  mark_from: number | null;
  /** Residual capacity of the used arc (c − f forward, f backward). */
  residual: number;
  /** New mark of `to` = min(mark_from, residual). */
  mark_to: number;
  /** Position of the input edge whose residual arc was used. */
  edge_index: number;
  /** True when a backward residual arc was used. */
  backward: boolean;
}

/** One animation frame of the flow execution trace. */
export interface FlowStepJson {
  /** 1-based frame number across the whole trace. */
  iteration: number;
  /** 1-based stage — detailed Ford–Fulkerson trace only. */
  stage?: number;
  /** 1-based step inside its stage — detailed Ford–Fulkerson trace only. */
  stage_step?: number;
  /** What the frame shows — detailed Ford–Fulkerson trace only. */
  kind?: FlowFrameKindJson;
  /** Every mark at this moment (sorted by vertex) — detailed trace only. */
  marks?: VertexMarkJson[];
  /** Marked vertices (розмічені), ascending — detailed trace only. */
  labeled?: number[];
  /** Not yet marked vertices (нерозмічені), ascending — detailed trace only. */
  unlabeled?: number[];
  /** Labeling computation of a `label` frame — detailed trace only. */
  computation?: LabelComputationJson;
  /** Reverse chain so far, sink … source — detailed trace only. */
  reverse_path?: number[];
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
