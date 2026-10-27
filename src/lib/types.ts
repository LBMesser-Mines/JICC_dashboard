// src/lib/types.ts

export type NodeId = string;
export type NodeRole = "supply" | "demand" | "transshipment";

// ---- metadata ----
export interface Metadata {
  source: string;
  name: string;
  nodes: number;
  edges: number;
  role_counts: Record<NodeRole, number>;
}

// ---- network (NetworkX node_link_data) ----
export interface NetworkNode {
  id: NodeId;
  pos: [lat: number, lon: number];
  /** Present in preprocessed data; otherwise derived from the id via deriveRole. */
  role?: NodeRole;
  /** Present in preprocessed data; otherwise derived from the id via deriveZone. */
  zone?: "US" | "MX";
}

export interface NetworkEdge {
  origin: NodeId;
  destination: NodeId;
  distance: number;
}

export interface Network {
  directed: boolean;
  multigraph: boolean;
  graph: Record<string, unknown>;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

// ---- routes ----
export interface Route {
  origin: NodeId;
  destination: NodeId;
  vehicle_type: string;
  vehicle_count: number;
  commodity: string;
  commodity_count: number;
  departure_interval: number;
  path: NodeId[];
  distance: number;
  error: string | null;
}

// ---- centrality: each metric maps node -> score ----
export type CentralityMetric =
  | "betweenness_subset"
  | "degree"
  | "closeness"
  | "katz";
export type Centrality = Record<CentralityMetric, Record<NodeId, number>>;

// ---- connectivity ----
export interface PairConnectivity {
  shortest_distance: number;
  /** keyed by percent as a string, e.g. "10.0" -> number of routes */
  routes_within_range: Record<string, number>;
  band_nodes: number;
  capped: boolean;
  status: string;
}

export interface PoeToDemand {
  percents: number[];
  max_paths: number;
  /** results[poeId][demandId] */
  results: Record<NodeId, Record<NodeId, PairConnectivity>>;
}

export interface Connectivity {
  poe_to_demand: PoeToDemand;
}

// ---- root ----
export interface TopoAnalysis {
  metadata: Metadata;
  network: Network;
  routes: Route[];
  centrality: Centrality;
  connectivity: Connectivity;
}

// ---- solver / sensor-assignment solution ----

/** The four centrality weights the utility score blends (sum to 1). */
export interface SolverWeights {
  degree: number;
  closeness: number;
  betweenness: number;
  katz: number;
}

export interface SolverConfig {
  weights: SolverWeights;
  radius_km: number;
  budget: number;
  cost: number;
  penalty_family: string;
  theta: number;
  gamma: number;
  rho2: number | null;
}

/** Optimizer outcome for the asset-placement MIP. */
export interface SolutionStats {
  status: string;
  objective: number;
  coverage_utility: number;
  overlap_penalty: number;
  n_deployed: number;
  n_covered: number;
  total_cost: number;
  mip_gap: number;
  runtime_s: number;
}

export interface ModelSummary {
  nodes: number;
  routes: number;
  budget: number;
  max_assets_A: number;
  weights: SolverWeights;
  radius_km: number;
  penalty_family: string;
  rho_schedule: number[];
  avg_coverage_set: number;
  max_G: number;
  median_G: number;
}

/** static/data/solution.json */
export interface Solution {
  network: string;
  config: SolverConfig;
  model_summary: ModelSummary;
  solution: SolutionStats;
  /** Node ids where a sensor/asset is placed. */
  deployed: NodeId[];
  /** Node ids falling within a deployed asset's coverage radius. */
  covered: NodeId[];
  /** route index (as string) -> number of deployed assets covering it. */
  route_asset_counts: Record<string, number>;
}

/** Per-metric contribution to a deployed node's utility score. */
export interface MetricDerivation {
  /** Percentile rank in [0, 1] for this metric. */
  a_kn: number;
  weight: number;
  /** a_kn * weight. */
  contribution: number;
}

/** One deployed asset, with the derivation of why it was chosen. */
export interface Deployment {
  node: NodeId;
  role: NodeRole;
  lat: number;
  lon: number;
  cost: number;
  utility_u_n: number;
  derivation: Record<"degree" | "closeness" | "betweenness" | "katz", MetricDerivation>;
  covers_nodes: number;
  coverage_value_G_n: number;
}

/** static/data/deployment_report.json */
export interface DeploymentReport {
  network: string;
  generated: string;
  status: string;
  objective: number;
  coverage_utility: number;
  overlap_penalty: number;
  n_deployed: number;
  n_covered: number;
  budget: number;
  total_cost: number;
  weights: SolverWeights;
  utility_formula: string;
  deployments: Deployment[];
}
