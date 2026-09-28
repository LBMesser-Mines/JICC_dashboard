export const glossary = {
  node: { term: "Node", definition: "A node" },
  edge: { term: "Edge", definition: "An edge" },
} as const satisfies Record<string, { term: string; definition: string }>;

export type TermID = keyof typeof glossary;
