export type Post = {
  title: string;
  slug: string;
  description: string;
  date: string;
  tags: string[];
  /** Minutes, taken from frontmatter and shown next to the title in listings. */
  readTime?: number;
  image?: string;
  draft: boolean;
  series?: string;
  seriesTitle?: string;
  module?: number;
  season?: number;
  tracks?: Array<"shared" | "software" | "ai" | "platform">;
  difficulty?: "foundation" | "intermediate" | "advanced";
  resourceTier?: "LOCAL-CORE" | "LOCAL-HEAVY";
  clusterProfile?: "core" | "networked" | "inference";
  labRuntime?: "docker" | "kubernetes" | "remote";
  requiredAddons?: string[];
  labTime?: number;
  prerequisites?: string[];
  labPath?: string;
  labRelease?: string | null;
  labRef?: string | null;
  lastVerified?: string | null;
};
