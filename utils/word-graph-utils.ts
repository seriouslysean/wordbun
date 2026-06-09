import type { WordData } from '#types';

import { corpusRelationMatch } from '#utils/word-data-utils';

export interface GraphNode {
  word: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: number;
  to: number;
}

export interface WordGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  size: number;
}

interface BuildOptions {
  size?: number;
}

/** Inset (px) from the viewBox edge, leaving room for node labels. */
const LAYOUT_PADDING = 70;

/**
 * Builds an undirected relationship graph from word enrichment: an edge joins
 * two words when one lists the other (synonym or associated word) AND that term
 * resolves to a corpus headword via {@link corpusRelationMatch} (exact or
 * derivational, e.g. `joyful` -> `joy`). The page-level relation display shares
 * the same matcher, so graph edges and on-page links stay consistent.
 *
 * Antonyms are intentionally NOT graphed: edges represent associative closeness,
 * and an antonym is a semantic opposite, not a neighbour. A word page may still
 * link a corpus-matched antonym without a corresponding edge here -- that
 * divergence is by design.
 *
 * Only connected words become nodes. Nodes are laid out deterministically on a
 * circle (sorted by word), so the SVG is stable across builds with no physics
 * simulation or dependencies. Empty graph when there are no in-corpus
 * relationships, so the caller can self-hide.
 */
export const buildWordGraph = (words: WordData[], options: BuildOptions = {}): WordGraph => {
  const size = options.size ?? 600;
  const radius = size / 2 - LAYOUT_PADDING;
  const center = size / 2;

  // Map lowercase -> original casing for display; the corpus set drives edges.
  const display = new Map(words.map(word => [word.word.toLowerCase(), word.word]));
  const corpus = new Set(display.keys());
  const adjacency = new Map<string, Set<string>>();

  const connect = (a: string, b: string): void => {
    if (!adjacency.has(a)) {
      adjacency.set(a, new Set());
    }
    adjacency.get(a)?.add(b);
  };

  for (const word of words) {
    const source = word.word.toLowerCase();
    const terms = [...(word.enrichment?.synonyms ?? []), ...(word.enrichment?.related ?? [])];
    for (const term of terms) {
      const target = corpusRelationMatch(term, corpus);
      if (!target || target === source) {
        continue;
      }
      connect(source, target);
      connect(target, source);
    }
  }

  const connectedWords = [...adjacency.keys()].toSorted();
  const indexOf = new Map(connectedWords.map((word, index) => [word, index]));
  const count = connectedWords.length;

  const nodes: GraphNode[] = connectedWords.map((word, index) => {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2;
    return {
      word: display.get(word) ?? word,
      x: Math.round((center + radius * Math.cos(angle)) * 100) / 100,
      y: Math.round((center + radius * Math.sin(angle)) * 100) / 100,
    };
  });

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const [source, targets] of adjacency) {
    const from = indexOf.get(source);
    for (const target of targets) {
      const to = indexOf.get(target);
      if (from === undefined || to === undefined) {
        continue;
      }
      const key = [from, to].toSorted((a, b) => a - b).join('-');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      edges.push({ from, to });
    }
  }

  return { nodes, edges, size };
};
