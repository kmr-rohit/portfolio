import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type FlyAndScaleParams = {
    y?: number;
    x?: number;
    start?: number;
    duration?: number;
};

export const flyAndScale = (
    node: Element,
    params: FlyAndScaleParams = { y: -8, x: 0, start: 0.95, duration: 150 }
): TransitionConfig => {
    const style = getComputedStyle(node);
    const transform = style.transform === "none" ? "" : style.transform;

    const scaleConversion = (
        valueA: number,
        scaleA: [number, number],
        scaleB: [number, number]
    ) => {
        const [minA, maxA] = scaleA;
        const [minB, maxB] = scaleB;

        const percentage = (valueA - minA) / (maxA - minA);
        return percentage * (maxB - minB) + minB;
    };

    const styleToString = (
        style: Record<string, number | string | undefined>
    ): string => {
        return Object.keys(style).reduce((str, key) => {
            if (style[key] === undefined) return str;
            return str + `${key}:${style[key]};`;
        }, "");
    };

    return {
        duration: params.duration ?? 200,
        delay: 0,
        css: (t) => {
            const y = scaleConversion(t, [0, 1], [params.y ?? 5, 0]);
            const x = scaleConversion(t, [0, 1], [params.x ?? 0, 0]);
            const scale = scaleConversion(t, [0, 1], [params.start ?? 0.95, 1]);

            return styleToString({
                transform: `${transform} translate3d(${x}px, ${y}px, 0) scale(${scale})`,
                opacity: t
            });
        },
        easing: cubicOut
    };
};

type DateStyle = Intl.DateTimeFormatOptions['dateStyle']

export function formatDate(date: string, dateStyle: DateStyle = 'medium', locales = 'en') {
	const dateToFormat = new Date(date.replaceAll('-', '/'))
	const dateFormatter = new Intl.DateTimeFormat(locales, { dateStyle })
	return dateFormatter.format(dateToFormat)
}

/** "July 2" — the year is already the group heading, so it is left off. */
export function formatDayMonth(date: string | Date, locales = 'en') {
	const value = typeof date === 'string' ? new Date(date.replaceAll('-', '/')) : date;
	return new Intl.DateTimeFormat(locales, { month: 'long', day: 'numeric' }).format(value);
}

export function getYear(date: string) {
	return new Date(date.replaceAll('-', '/')).getFullYear();
}

/**
 * Buckets dated items into descending years, preserving the order they arrive
 * in within each year.
 */
export function groupByYear<T extends { date: string }>(items: T[]) {
	const years = new Map<number, T[]>();

	for (const item of items) {
		const year = getYear(item.date);
		const bucket = years.get(year);
		if (bucket) {
			bucket.push(item);
		} else {
			years.set(year, [item]);
		}
	}

	return [...years.entries()]
		.sort((a, b) => b[0] - a[0])
		.map(([year, entries]) => ({ year, entries }));
}