/**
 * System design notes for /learn/system-design.
 *
 * The markdown in content/system-design/ is generated from the SystemDesign
 * Obsidian vault by scripts/system-design/import.mjs; edit the vault and
 * re-run the importer rather than editing the generated files.
 */

const WORDS_PER_MINUTE = 200;

const modules = import.meta.glob("/content/system-design/*.md", { eager: true });
const sources = import.meta.glob("/content/system-design/*.md", {
  eager: true,
  as: "raw",
});

export type ConceptTier = "core" | "useful" | "breadth";

export type Concept = {
  slug: string;
  title: string;
  summary: string;
  stage: number;
  stageName: string;
  tier: ConceptTier;
  seq: number;
  tags: string[];
  readTime: number;
  diagrams: number;
};

export type ConceptStage = {
  number: number;
  name: string;
  concepts: Concept[];
};

function estimateReadTime(source: string) {
  const words = source
    .replace(/^---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const concepts: Concept[] = Object.entries(modules)
  .map(([path, file]) => {
    const metadata = (file as { metadata: Omit<Concept, "slug" | "readTime" | "diagrams"> })
      .metadata;
    const source = (sources[path] as unknown as string) ?? "";
    return {
      ...metadata,
      slug: path.split("/").pop()!.replace(/\.md$/, ""),
      readTime: estimateReadTime(source),
      diagrams: (source.match(/class="sd-figure"/g) ?? []).length,
    };
  })
  .sort((a, b) => a.stage - b.stage || a.seq - b.seq || a.title.localeCompare(b.title));

export function getConcepts(): Concept[] {
  return concepts;
}

export function getConcept(slug: string): Concept | undefined {
  return concepts.find((concept) => concept.slug === slug);
}

export function getStages(): ConceptStage[] {
  const stages = new Map<number, ConceptStage>();
  for (const concept of concepts) {
    const stage = stages.get(concept.stage) ?? {
      number: concept.stage,
      name: concept.stageName,
      concepts: [],
    };
    stage.concepts.push(concept);
    stages.set(concept.stage, stage);
  }
  return [...stages.values()];
}

/** Previous and next note in reading order (stage, then sequence). */
export function getNeighbors(slug: string) {
  const index = concepts.findIndex((concept) => concept.slug === slug);
  return {
    previous: index > 0 ? concepts[index - 1] : null,
    next: index >= 0 && index < concepts.length - 1 ? concepts[index + 1] : null,
  };
}

export function formatStage(stage: number) {
  return String(stage).padStart(2, "0");
}
