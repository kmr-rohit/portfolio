import { writable, type Writable } from 'svelte/store';

type Theme = 'light' | 'dark' | 'system';

/** Mirrors the active colour mode so the giscus iframe can follow it. */
export const theme: Writable<Theme> = writable<Theme>();
