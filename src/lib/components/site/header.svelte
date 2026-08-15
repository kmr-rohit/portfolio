<script lang="ts">
  import { page } from "$app/stores";
  import { routes, site, socials } from "$lib/config";
  import ThemeToggle from "./theme-toggle.svelte";

  $: isKubernetesCourseArticle =
    ($page.data as { meta?: { series?: string } }).meta?.series ===
    "kubernetes";
  $: isActive = (link: string) => {
    if (isKubernetesCourseArticle) {
      if (link === "/learn/kubernetes") return true;
      if (link === "/writing") return false;
    }

    return (
      $page.url.pathname === link || $page.url.pathname.startsWith(`${link}/`)
    );
  };

  const github = socials.find((s) => s.display === "GitHub");
  const linkedin = socials.find((s) => s.display === "LinkedIn");
  const email = socials.find((s) => s.display === "Email");
</script>

<header class="top">
  <a
    href="/"
    class="name"
    aria-current={$page.url.pathname === "/" ? "page" : undefined}
  >
    {site.name}
  </a>

  <nav aria-label="Primary">
    {#each routes as route (route.link)}
      <a
        href={route.link}
        aria-current={isActive(route.link) ? "page" : undefined}
      >
        {route.name.toLowerCase()}
      </a>
    {/each}
  </nav>

  <div class="top-socials">
    {#if github}
      <a
        href={github.href}
        class="icon-btn no-highlight"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub"
        title="GitHub"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 2C6.477 2 2 6.586 2 12.223c0 4.515 2.865 8.342 6.839 9.694.5.094.683-.223.683-.495 0-.244-.01-1.052-.014-1.908-2.782.62-3.369-1.38-3.369-1.38-.455-1.181-1.11-1.495-1.11-1.495-.908-.638.069-.625.069-.625 1.004.072 1.532 1.06 1.532 1.06.892 1.57 2.341 1.116 2.91.854.091-.662.35-1.116.636-1.372-2.22-.259-4.555-1.14-4.555-5.077 0-1.121.39-2.038 1.029-2.757-.103-.26-.446-1.302.098-2.714 0 0 .84-.276 2.75 1.052A9.348 9.348 0 0 1 12 6.936a9.35 9.35 0 0 1 2.504.346c1.909-1.328 2.748-1.052 2.748-1.052.546 1.412.202 2.454.1 2.714.64.719 1.028 1.636 1.028 2.757 0 3.947-2.339 4.815-4.566 5.069.359.317.679.943.679 1.901 0 1.372-.012 2.477-.012 2.814 0 .274.18.593.688.492C19.138 20.561 22 16.735 22 12.223 22 6.586 17.523 2 12 2z"
          />
        </svg>
      </a>
    {/if}
    {#if linkedin}
      <a
        href={linkedin.href}
        class="icon-btn no-highlight"
        target="_blank"
        rel="noreferrer"
        aria-label="LinkedIn"
        title="LinkedIn"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
          />
        </svg>
      </a>
    {/if}
    {#if email}
      <a
        href={email.href}
        class="icon-btn no-highlight"
        aria-label="Email"
        title="Email"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      </a>
    {/if}
    <ThemeToggle />
  </div>
</header>
