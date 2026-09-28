// Keys for roles and metrics match NodeRole / MetricKey so components can pass them straight to <Term>.
export const glossary = {
  node: {
    term: "Node",
    definition: "A location in the network: a supply region, a port of entry, or a destination city.",
  },
  edge: {
    term: "Edge",
    definition: "A direct connection between two nodes that shipments can travel along. Its length is measured in km.",
  },

  // ---- roles ----
  role: {
    term: "Role",
    definition:
      "What a node does in the network: supply (where routes start), transshipment (where routes cross the border), or demand (where routes end).",
  },
  supply: {
    term: "Supply",
    definition: "Role of a region in Mexico where routes originate, e.g. a cartel's production or staging area.",
  },
  transshipment: {
    term: "Transshipment",
    definition: "Role of a US–Mexico port of entry, where shipments cross the border into the US.",
  },
  demand: {
    term: "Demand",
    definition: "Role of a US city where routes end and drugs are distributed or consumed.",
  },
  poe: {
    term: "Port of entry (POE)",
    definition: "An official US–Mexico border crossing. Every route crosses the border at one POE.",
  },

  // ---- centrality ----
  centrality: {
    term: "Centrality",
    definition:
      "A family of scores measuring how important a node is to the network's structure. Each one captures a different kind of importance.",
  },
  betweenness_subset: {
    term: "Betweenness",
    definition:
      "Betweenness centrality: how often a node lies on the shortest paths between supply and demand nodes. High values mark chokepoints, where disruption would affect many routes.",
  },
  degree: {
    term: "Degree",
    definition:
      "Degree centrality: the share of all other nodes that a node is directly connected to. High values mark local hubs.",
  },
  closeness: {
    term: "Closeness",
    definition:
      "Closeness centrality: the inverse of a node's average shortest-path distance to every other node. High values mean the node can reach the rest of the network quickly.",
  },
  katz: {
    term: "Katz",
    definition:
      "Katz centrality: influence counted over all paths through the network, with longer paths discounted. High values mean a node is well connected to other well-connected nodes.",
  },
  connectivity: {
    term: "Path redundancy",
    definition:
      "The average number of alternative paths within 10% of the shortest path between a port of entry and its demand cities. High values mean routes are hard to disrupt by blocking a single link.",
  },
} as const satisfies Record<string, { term: string; definition: string }>;

export type TermID = keyof typeof glossary;
