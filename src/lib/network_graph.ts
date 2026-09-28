// src/lib/network_graph.ts
// Pure helpers that turn TopoAnalysis data into GeoJSON for the MapLibre network view.
// Kept free of Svelte/MapLibre so the data->geometry logic stays testable and the
// metric/zone seams live in one place.

import type { FeatureCollection } from "geojson";
import type {
  Network,
  Route,
  NodeId,
  NodeRole,
  Centrality,
  CentralityMetric,
  Connectivity,
} from "$lib/types";

/** A per-node metric that can drive node color/size. */
export type MetricKey = CentralityMetric | "connectivity";
/** How nodes are colored: by role, or by a numeric metric. */
export type ColorMode = "role" | MetricKey;

/** Toggle options for the metric selector (order = display order). */
export const METRIC_OPTIONS: { key: ColorMode; label: string }[] = [
  { key: "role", label: "Role" },
  { key: "betweenness_subset", label: "Betweenness" },
  { key: "degree", label: "Degree" },
  { key: "closeness", label: "Closeness" },
  { key: "katz", label: "Katz" },
];

export const METRIC_KEYS: MetricKey[] = [
  "betweenness_subset",
  "degree",
  "closeness",
  "katz",
  "connectivity",
];

/** Sequential low->high color ramp (YlOrRd) for metric coloring. */
export const METRIC_RAMP = ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"];

/** Geographic zone a node belongs to. Mexico = `_mex` suffix (supply regions). */
export type Zone = "US" | "MX";

export function deriveZone(id: NodeId): Zone {
  return id.endsWith("_mex") ? "MX" : "US";
}

export const ZONE_OPTIONS: { key: Zone; label: string }[] = [
  { key: "US", label: "United States" },
  { key: "MX", label: "Mexico" },
];

/** Overlay colors for the zone regions (blue = USA, red = Mexico). */
export const ZONE_COLORS: Record<Zone, string> = {
  US: "#3b82f6",
  MX: "#ef4444",
};

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/** The centrality metrics baked into every node feature (metric-toggle seam). */
export const CENTRALITY_METRICS = [
  "betweenness_subset",
  "degree",
  "closeness",
  "katz",
] as const;

/**
 * Nodes carry no role field; derive it from the id.
 * Verified against metadata.role_counts (transshipment=33, supply=84, demand=346):
 *   - `poe_` prefix  -> transshipment
 *   - `_mex` suffix  -> supply
 *   - otherwise      -> demand
 */
export function deriveRole(id: NodeId): NodeRole {
  if (id.startsWith("poe_")) return "transshipment";
  if (id.endsWith("_mex")) return "supply";
  return "demand";
}

/** Single source of truth for role colors — shared by the map paint and the legend. */
export const ROLE_COLORS: Record<NodeRole, string> = {
  supply: "#2a9d8f",
  demand: "#e76f51",
  transshipment: "#e9c46a",
};

/** nodeId -> [lat, lon]. Build once; reused by the edge and route builders. */
export function buildPosLookup(net: Network): Map<NodeId, [number, number]> {
  return new Map(net.nodes.map((n) => [n.id, n.pos]));
}

/**
 * Point features for every node. Role and all centrality metrics are baked into
 * `properties` so a later metric toggle is a one-line `['get', metric]` in the paint
 * expression — no re-fetch or source rebuild required.
 * Note: GeoJSON coordinates are [lon, lat]; `pos` is [lat, lon], so they are swapped.
 */
export function buildNodeGeoJSON(
  net: Network,
  centrality?: Centrality,
  connScores?: Record<NodeId, number>,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: net.nodes
      .filter((n) => Number.isFinite(n.pos?.[0]) && Number.isFinite(n.pos?.[1]))
      .map((n) => {
        const properties: Record<string, unknown> = {
          id: n.id,
          role: deriveRole(n.id),
          zone: deriveZone(n.id),
          connectivity: connScores?.[n.id] ?? 0,
        };
        for (const m of CENTRALITY_METRICS) {
          properties[m] = centrality?.[m]?.[n.id] ?? 0;
        }
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [n.pos[1], n.pos[0]] },
          properties,
        };
      }),
  };
}

/** One LineString per direct edge; edges with an unknown endpoint are skipped. */
export function buildEdgeGeoJSON(
  net: Network,
  pos: Map<NodeId, [number, number]>,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: net.edges.flatMap((e) => {
      const a = pos.get(e.origin);
      const b = pos.get(e.destination);
      if (!a || !b) return [];
      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [a[1], a[0]],
              [b[1], b[0]],
            ],
          },
          properties: {
            origin: e.origin,
            destination: e.destination,
            distance: e.distance,
            originZone: deriveZone(e.origin),
            destZone: deriveZone(e.destination),
          },
        },
      ];
    }),
  };
}

/** All routes that touch a node (as origin, destination, or along the path). */
export function routesForNode(routes: Route[], id: NodeId): Route[] {
  return routes.filter(
    (r) => r.origin === id || r.destination === id || r.path.includes(id),
  );
}

/** Colors for the nodes along a focused route. */
export const ROUTE_NODE_COLORS = {
  source: "#16a34a", // origin (supply)
  via: "#2563eb", // intermediate
  demand: "#dc2626", // destination
};

/**
 * Point features for each node in a focused route's path, tagged with its
 * position: 'source' (first), 'demand' (last), or 'via' (in between).
 */
export function buildRouteNodesGeoJSON(
  route: Route | null,
  pos: Map<NodeId, [number, number]>,
): FeatureCollection {
  if (!route) return { type: "FeatureCollection", features: [] };
  const path = route.path;
  return {
    type: "FeatureCollection",
    features: path.flatMap((id, i) => {
      const p = pos.get(id);
      if (!p) return [];
      const routePos =
        i === 0 ? "source" : i === path.length - 1 ? "demand" : "via";
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p[1], p[0]] },
          properties: { id, routePos },
        },
      ];
    }),
  };
}

/** One LineString per route, built from its path of node ids. */
export function buildRouteHighlightGeoJSON(
  routes: Route[],
  pos: Map<NodeId, [number, number]>,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: routes.flatMap((r, i) => {
      const coords = r.path
        .map((nid) => pos.get(nid))
        .filter((p): p is [number, number] => !!p)
        .map((p) => [p[1], p[0]]);
      if (coords.length < 2) return [];
      return [
        {
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: coords },
          properties: {
            routeIndex: i,
            commodity: r.commodity,
            vehicle_type: r.vehicle_type,
          },
        },
      ];
    }),
  };
}

/**
 * Per-node "connectivity score" = path redundancy: the average number of
 * near-shortest paths (routes_within_range at the first percent band) across a
 * node's POE<->demand pairs.
 *   - POE node:    averaged over all demand cities it reaches.
 *   - demand node: averaged over all POEs that reach it.
 *   - supply node: no connectivity data -> 0.
 */
export function computeConnectivityScores(
  conn?: Connectivity,
): Record<NodeId, number> {
  const scores: Record<NodeId, number> = {};
  if (!conn) return scores;
  const { percents, results } = conn.poe_to_demand;
  const bandKey = (percents[0] ?? 10).toFixed(1); // e.g. "10.0"

  const demandSum: Record<NodeId, number> = {};
  const demandCount: Record<NodeId, number> = {};

  for (const poe of Object.keys(results)) {
    const row = results[poe];
    const demands = Object.keys(row);
    let sum = 0;
    for (const dm of demands) {
      const v = row[dm].routes_within_range[bandKey] ?? 0;
      sum += v;
      demandSum[dm] = (demandSum[dm] ?? 0) + v;
      demandCount[dm] = (demandCount[dm] ?? 0) + 1;
    }
    scores[poe] = demands.length ? sum / demands.length : 0;
  }
  for (const dm of Object.keys(demandSum)) {
    scores[dm] = demandSum[dm] / demandCount[dm];
  }
  return scores;
}

/** [min, max] per metric across all nodes, for normalizing color/size ramps. */
export function computeMetricDomains(
  net: Network,
  centrality?: Centrality,
  connScores?: Record<NodeId, number>,
): Record<MetricKey, [number, number]> {
  const domains = {} as Record<MetricKey, [number, number]>;
  for (const m of METRIC_KEYS) {
    let min = Infinity;
    let max = -Infinity;
    for (const n of net.nodes) {
      const v =
        m === "connectivity"
          ? (connScores?.[n.id] ?? 0)
          : (centrality?.[m]?.[n.id] ?? 0);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    domains[m] = [
      Number.isFinite(min) ? min : 0,
      Number.isFinite(max) ? max : 1,
    ];
  }
  return domains;
}

/** Compact formatting for legend min/max labels. */
export function formatMetric(v: number): string {
  if (v === 0) return "0";
  if (Math.abs(v) >= 100) return Math.round(v).toLocaleString();
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toPrecision(2);
}

/** Convex hull (Andrew's monotone chain) over [lon, lat] points. */
export function convexHull(pts: [number, number][]): [number, number][] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number],
  ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: [number, number][] = [];
  for (const q of p) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0
    )
      lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0
    )
      upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * A translucent region polygon per selected zone (convex hull of that zone's
 * node positions), drawn behind the nodes to shade US vs Mexico.
 */
export function buildZoneOverlayGeoJSON(
  net: Network,
  zones: Zone[],
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.flatMap((zone) => {
      const pts = net.nodes
        .filter(
          (n) =>
            deriveZone(n.id) === zone &&
            Number.isFinite(n.pos?.[0]) &&
            Number.isFinite(n.pos?.[1]),
        )
        .map((n) => [n.pos[1], n.pos[0]] as [number, number]); // [lon, lat]
      const hull = convexHull(pts);
      if (hull.length < 3) return [];
      const ring = [...hull, hull[0]]; // close the ring
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [ring] },
          properties: { zone },
        },
      ];
    }),
  };
}

export { EMPTY_FC };
