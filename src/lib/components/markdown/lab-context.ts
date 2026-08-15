export const markdownLabContextKey = Symbol("markdown-lab-context");

export type MarkdownLabContext = {
  readonly path: string;
  readonly ref: string;
  readonly pinned: boolean;
  readonly url: string;
};
