<script lang="ts">
  import { PostList, Seo } from "$lib/components/site";

  export let data;
</script>

<Seo
  title="Writing"
  description="Long-form notes and learning series on Kubernetes, LLM serving, agent design and the systems underneath."
/>

<header class="essay-index-head">
  <h1>Writing</h1>
  <p class="essay-index-lede">
    Long-form notes on the systems underneath the API — Kubernetes, serving
    engines, agent harnesses, retrieval and the parts of evaluation nobody
    enjoys. Written to check my own understanding, so they tend to go one level
    deeper than they need to.
  </p>

  <a class="course-entry" href="/learn/kubernetes">
    <span>
      <small>New learning series · 27 modules</small>
      <strong>Kubernetes from first principles</strong>
    </span>
    <b>Open course map →</b>
  </a>
</header>

<PostList posts={data.posts} variant="essay" />

<style>
  .course-entry {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    margin-top: 28px;
    padding-block: 14px;
    border-block: 1px solid var(--hairline);
    transition: padding 160ms ease, background 160ms ease;
  }

  .course-entry:hover {
    padding-inline: 10px;
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }

  .course-entry span {
    display: grid;
    gap: 4px;
  }

  .course-entry small,
  .course-entry b {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.61rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .course-entry strong {
    font-size: 0.98rem;
    font-weight: 400;
    letter-spacing: 0.025em;
  }

  .course-entry b {
    color: var(--accent);
    white-space: nowrap;
  }

  @media (max-width: 520px) {
    .course-entry {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
