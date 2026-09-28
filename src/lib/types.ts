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
