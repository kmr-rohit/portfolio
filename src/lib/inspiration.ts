/**
 * Mood-board images for /inspiration.
 * Drop files into `static/inspiration/` and list them here.
 * When the Drive folder arrives we’ll import + wire them up.
 */
export type InspirationImage = {
	/** Path under /static, e.g. `/inspiration/banff-01.jpg` */
	src: string;
	alt: string;
	/** Optional caption shown on hover / focus. */
	caption?: string;
	/** food | landscape | other — used for light filtering later if wanted. */
	kind?: 'food' | 'landscape' | 'other';
};

export const inspirationImages: InspirationImage[] = [
	// Populated once the Drive folder is shared. Example:
	// { src: '/inspiration/ramen-shibuya.jpg', alt: 'Late-night ramen', kind: 'food', caption: 'Shibuya' },
];
