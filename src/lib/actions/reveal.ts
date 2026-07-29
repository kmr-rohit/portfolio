import type { Action } from 'svelte/action';

type RevealParams = {
	/** Delay before the element begins to appear, in ms. */
	delay?: number;
	/** When true (default) the observer disconnects after the first reveal. */
	once?: boolean;
};

/**
 * Fades and lifts an element into place.
 *
 * - Above the fold: plays a short entrance once on mount.
 * - Below the fold: stays put until scrolled into view, then reveals.
 * - Honours `prefers-reduced-motion`.
 *
 * SSR stays fully visible (no opacity:0 in markup) so content never flashes blank.
 */
export const reveal: Action<HTMLElement, RevealParams | undefined> = (node, params = {}) => {
	const { delay = 0, once = true } = params ?? {};

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduced) return {};

	node.style.setProperty('--reveal-delay', `${delay}ms`);

	const play = () => {
		// Park at the start of the transition without animating there…
		node.style.transition = 'none';
		node.classList.add('reveal');
		node.classList.remove('is-revealed');
		void node.offsetWidth;
		// …then release and animate to the resting state.
		node.style.removeProperty('transition');
		node.classList.add('is-revealed');
	};

	const rect = node.getBoundingClientRect();
	const inView = rect.top < window.innerHeight * 0.94 && rect.bottom > 0;

	if (inView) {
		play();
		return {};
	}

	// Off-screen: hide now, reveal when scrolled to.
	node.classList.add('reveal');

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				node.classList.add('is-revealed');
				if (once) observer.unobserve(node);
			}
		},
		{ rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		}
	};
};
