<script lang="ts">
  import { KubernetesCourseNav, Seo } from "$lib/components/site";
  import {
    markdownLabContextKey,
    type MarkdownLabContext,
  } from "$lib/components/markdown/lab-context";
  import { Giscus } from "$lib/components/site/gicsus_";
  import {
    commentsEnabled,
    giscus,
    githubConfig,
    githubTreeURL,
    site,
  } from "$lib/config";
  import { theme } from "$lib/stores";
  import { formatDate } from "$lib/utils";
  import { onMount, setContext } from "svelte";

  export let data;

  const labContext: MarkdownLabContext = {
    get path() {
      return data?.meta?.labPath ?? "";
    },
    get ref() {
      return data?.meta?.labRef ?? githubConfig.branch;
    },
    get pinned() {
      return Boolean(data?.meta?.labRef);
    },
    get url() {
      const path = data?.meta?.labPath;
      const ref = data?.meta?.labRef ?? githubConfig.branch;
      return path ? githubTreeURL(path, ref) : "";
    },
  };

  setContext(markdownLabContextKey, labContext);

  $: ({ content, meta, newer, older, seriesNavigation } = data);

  let storedTheme: string | undefined;

  onMount(() => {
    storedTheme = localStorage.getItem("mode")?.replace(/^"(.*)"$/, "$1");
  });

  $: tags = (meta.tags ?? []).filter(Boolean);

  function runtimeLabel(value: string) {
    if (value === "docker") return "Docker only";
    if (value === "kubernetes") return "Docker + Kubernetes";
    if (value === "remote") return "Remote environment";
    return value;
  }

  function clusterLabel(value: string) {
    if (value === "core") return "2-node local cluster";
    if (value === "networked") return "Local network lab";
    if (value === "inference") return "Local inference lab";
    return value;
  }

  function laptopLabel(value: string) {
    if (value === "LOCAL-CORE") return "16 GB Mac";
    if (value === "LOCAL-HEAVY") return "24 GB+ Mac";
    return value;
  }
</script>

<Seo
  title={meta.title}
  description={meta.description}
  image={meta.image}
  type="article"
  publishedAt={meta.date}
/>

<article class="essay">
  {#if seriesNavigation}
    <KubernetesCourseNav
      current={seriesNavigation.current}
      previous={seriesNavigation.previous}
      next={seriesNavigation.next}
      route={seriesNavigation.route}
    />
  {:else}
    <a href="/writing" class="back">← Writing</a>
  {/if}

  <header class="essay-head">
    {#if tags.length}
      <p class="essay-kicker">{tags.join(" · ")}</p>
    {/if}
    <h1>{meta.title}</h1>
    <p class="essay-meta">
      <time datetime={meta.date}>{formatDate(meta.date, "long")}</time>
      {#if meta.readTime}
        <span class="essay-dot" aria-hidden="true">·</span>
        <span>{meta.readTime} min read</span>
      {/if}
      <span class="essay-dot" aria-hidden="true">·</span>
      <span>{site.name}</span>
    </p>
    {#if meta.description}
      <p class="essay-standfirst">{meta.description}</p>
    {/if}
    {#if seriesNavigation}
      <ul class="course-lab-facts" aria-label="Lab requirements">
        {#if meta.labTime}<li>
            <span>Practice time</span>{meta.labTime} min
          </li>{/if}
        {#if meta.labRuntime}<li>
            <span>Uses</span>{runtimeLabel(meta.labRuntime)}
          </li>{/if}
        {#if meta.clusterProfile}<li>
            <span>Cluster setup</span>{clusterLabel(meta.clusterProfile)}
          </li>{/if}
        {#if meta.resourceTier}<li>
            <span>Laptop</span>{laptopLabel(meta.resourceTier)}
          </li>{/if}
        <li>
          <span>Last tested</span>{meta.lastVerified
            ? formatDate(meta.lastVerified)
            : "pending local run"}
        </li>
      </ul>
    {/if}
  </header>

  <div class="essay-rule" aria-hidden="true" />

  <div class="mdsvex essay-body" id="mdsvex">
    <svelte:component this={content} />
  </div>

  <footer class="essay-foot">
    <p class="essay-foot-note">
      Thanks for reading. If something here is wrong or unclear, open an issue
      on the
      <a
        href="https://github.com/kmr-rohit/portfolio"
        class="bio-link"
        target="_blank"
        rel="noreferrer">site repo</a
      >
      or write me.
    </p>
  </footer>

  {#if seriesNavigation}
    <KubernetesCourseNav
      variant="pager"
      current={seriesNavigation.current}
      previous={seriesNavigation.previous}
      next={seriesNavigation.next}
      route={seriesNavigation.route}
    />
  {:else}
    <nav class="pager">
      <div class="max-w-xs space-y-1">
        {#if older}
          <p class="section-label" style="margin-bottom: 4px">Older</p>
          <a href="/writing/{older.slug}">{older.title}</a>
        {/if}
      </div>
      <div class="max-w-xs space-y-1 text-right">
        {#if newer}
          <p class="section-label" style="margin-bottom: 4px">Newer</p>
          <a href="/writing/{newer.slug}">{newer.title}</a>
        {/if}
      </div>
    </nav>
  {/if}

  {#if commentsEnabled}
    <div id="comments" class="pt-10">
      <Giscus
        repo={giscus.repo}
        repoId={giscus.repoId}
        category={giscus.category}
        categoryId={giscus.categoryId}
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme={$theme ? $theme : storedTheme}
        lang="en"
      />
    </div>
  {/if}
</article>

<style>
  .course-lab-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 20px;
    margin: 24px 0 0;
    padding: 14px 0 0;
    border-top: 1px solid var(--hairline);
    list-style: none;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.68rem;
    letter-spacing: 0.035em;
    color: var(--ink);
  }

  .course-lab-facts li {
    display: grid;
    gap: 2px;
    min-width: 0;
    max-width: 100%;
    text-transform: lowercase;
  }

  .course-lab-facts span {
    font-family: var(--font);
    font-size: 0.58rem;
    letter-spacing: var(--track-nav);
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  @media (max-width: 540px) {
    .course-lab-facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 16px;
    }

    .course-lab-facts li {
      overflow-wrap: anywhere;
    }
  }

  @media (max-width: 360px) {
    .course-lab-facts {
      grid-template-columns: 1fr;
    }
  }
</style>
