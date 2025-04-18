import type { AbstractDriver } from "../Drivers/AbstractDriver";
import type { AbstractLibrary } from "../Library/AbstractLibrary";
import type { RainlinkNode } from "../Node/RainlinkNode";
import type { RainlinkRest } from "../Node/RainlinkRest";
import type { RainlinkFilter } from "../Player/RainlinkFilter";
import type { RainlinkPlayer } from "../Player/RainlinkPlayer";
import type { RainlinkQueue } from "../Player/RainlinkQueue";
import type { RainlinkTrack } from "../Player/RainlinkTrack";
import type { RainlinkPlugin } from "../Plugin/RainlinkPlugin";

/**
 * A structure interface
 */
export type Constructor<T> = new (...args: any[]) => T;

/**
 * The structures options interface for custom class/structures
 */
export interface Structures {
	/**
	 * A custom structure that extends the RainlinkRest class
	 */
	rest?: Constructor<RainlinkRest>;
	/**
	 * A custom structure that extends the RainlinkPlayer class
	 */
	player?: Constructor<RainlinkPlayer>;
	/**
	 * A custom structure that extends the RainlinkQueue class
	 */
	queue?: Constructor<RainlinkQueue>;
	/**
	 * A custom structure that extends the RainlinkQueue class
	 */
	filter?: Constructor<RainlinkFilter>;
}

/**
 * Rainlink node option interface
 */
export interface RainlinkNodeOptions {
	/** Name for get the lavalink server info in rainlink */
	name: string;
	/** The ip address or domain of lavalink server */
	host: string;
	/** The port that lavalink server exposed */
	port: number;
	/** The password of lavalink server */
	auth: string;
	/** Whenever lavalink user ssl or not */
	secure: boolean;
	/** The driver class for handling lavalink response */
	driver?: string;
	/** Use legacy ws client (Require install [ws](https://www.npmjs.com/package/ws) package, If you use bun, do not enable this option) */
	legacyWS?: boolean;
	/** The region of the node */
	region?: string;
}

/**
 * Some rainlink additional config option
 */
export interface RainlinkAdditionalOptions {
	/** Additional custom driver for rainlink (no need 'new' keyword when add). Example: `additionalDriver: Lavalink4` */
	additionalDriver?: Array<Constructor<AbstractDriver>>;
	/** Timeout before trying to reconnect (ms) */
	retryTimeout?: number;
	/** Number of times to try and reconnect to Lavalink before giving up */
	retryCount?: number;
	/** The retry timeout for voice manager when dealing connection to discord voice server (ms) */
	voiceConnectionTimeout?: number;
	/** The default search engine like default search from youtube, spotify,... */
	defaultSearchEngine?: string;
	/** The default volume when create a player */
	defaultVolume?: number;
	/** Search track from youtube when track resolve failed */
	searchFallback?: {
		/** Whenever enable this search fallback or not */
		enable: boolean;
		/** Choose a fallback search engine, recommended soundcloud and youtube */
		engine: string;
	};
	/** Whether to resume a connection on disconnect to Lavalink (Server Side) (Note: DOES NOT RESUME WHEN THE LAVALINK SERVER DIES) */
	resume?: boolean;
	/** When the seasion is deleted from Lavalink. Use second (Server Side) (Note: DOES NOT RESUME WHEN THE LAVALINK SERVER DIES) */
	resumeTimeout?: number;
	/** User Agent to use when making requests to Lavalink */
	userAgent?: string;
	/** Node Resolver to use if you want to customize it */
	nodeResolver?: (nodes: RainlinkNode[]) => Promise<RainlinkNode | undefined>;
	/** Custom structures for rainlink to use */
	structures?: Structures;
}

/**
 * Rainlink config interface
 */
export interface RainlinkOptions {
	/** The lavalink server credentials array */
	nodes: RainlinkNodeOptions[];
	/** The discord library for using voice manager, example: discordjs, erisjs. Check {@link Library} */
	library: AbstractLibrary;
	/** The rainlink plugins array. Check {@link RainlinkPlugin} */
	plugins?: RainlinkPlugin[];
	/** Rainlink additional options  */
	options?: RainlinkAdditionalOptions;
}

/**
 * The type enum of rainlink search function result
 */
export enum RainlinkSearchResultType {
	TRACK = "TRACK",
	PLAYLIST = "PLAYLIST",
	SEARCH = "SEARCH"
}

/**
 * The rainlink search function result interface
 */
export interface RainlinkSearchResult {
	type: RainlinkSearchResultType;
	playlistName?: string;
	tracks: RainlinkTrack[];
}

/**
 * The rainlink search function options interface
 */
export interface RainlinkSearchOptions {
	/** User info of who request the song */
	requester?: unknown;
	/** Which node do user want to use (get using node name) */
	nodeName?: string;
	/** Which search engine do user want to use (get using search engine name) */
	engine?: string;
	/** Directlly search with source id avaliable in Lavalink (bypass all plugins) */
	sourceID?: string;
}
