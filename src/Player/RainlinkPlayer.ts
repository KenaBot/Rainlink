import { PlayEncodedOptions, PlayOptions, VoiceChannelOptions } from '../Interface/Player';
import { Rainlink } from '../Rainlink';
import { RainlinkNode } from '../Node/RainlinkNode';
import { RainlinkQueue } from './RainlinkQueue';
import { RainlinkVoiceManager } from '../Manager/RainlinkVoiceManager';
import {
  RainlinkEvents,
  RainlinkFilterData,
  RainlinkLoopMode,
  RainlinkPlayerState,
} from '../Interface/Constants';
import { RainlinkTrack } from './RainlinkTrack';
import { UpdatePlayerInfo, UpdatePlayerOptions } from '../Interface/Rest';
import { Snowflake } from 'discord.js';
import { RainlinkSearchOptions, RainlinkSearchResult } from '../Interface/Manager';

export class RainlinkPlayer {
  /**
   * Main manager class
   */
  public manager: Rainlink;
  /**
   * Voice option of player
   */
  public voiceOptions: VoiceChannelOptions;
  /**
   * Player's current using lavalink server
   */
  public node: RainlinkNode;
  /**
   * Player's guild id
   */
  public guildId: string;
  /**
   * Player's voice id
   */
  public voiceId: string;
  /**
   * Player's text id
   */
  public textId: string;
  /**
   * Player's queue
   */
  public readonly queue: RainlinkQueue;
  /**
   * The temporary database of player, u can set any thing here and us like Map class!
   */
  public readonly data: Map<string, any>;
  /**
   * Whether the player is paused or not
   */
  public paused: boolean;
  /**
   * Get the current track's position of the player
   */
  public position: number;
  /**
   * Get the current volume of the player
   */
  public volume: number;
  /**
   * Whether the player is playing or not
   */
  public playing: boolean;
  /**
   * Get the current loop mode of the player
   */
  public loop: RainlinkLoopMode;
  /**
   * Get the current state of the player
   */
  public state: RainlinkPlayerState;
  /**
   * Whether the player is deafened or not
   */
  public deafened: boolean;
  /**
   * Whether the player is muted or not
   */
  public muted: boolean;
  /**
   * Player's voice manager
   */
  public voiceManager: RainlinkVoiceManager;

  /**
   * The rainlink player handler class
   * @param manager The rainlink manager
   * @param voiceOptions The rainlink voice option, use VoiceChannelOptions interface
   * @param node The rainlink current use node
   * @param voiceManager The rainlink current voice manager
   */
  constructor(
    manager: Rainlink,
    voiceOptions: VoiceChannelOptions,
    node: RainlinkNode,
    voiceManager: RainlinkVoiceManager,
  ) {
    this.manager = manager;
    this.voiceOptions = voiceOptions;
    this.node = node;
    this.guildId = this.voiceOptions.guildId;
    this.voiceId = this.voiceOptions.voiceId;
    this.textId = this.voiceOptions.textId;
    this.queue = new RainlinkQueue(this.manager, this);
    this.data = new Map<string, any>();
    this.paused = false;
    this.position = 0;
    this.volume = this.manager.rainlinkOptions.options.defaultVolume!;
    this.playing = false;
    this.loop = RainlinkLoopMode.NONE;
    this.state = RainlinkPlayerState.DESTROYED;
    this.deafened = voiceManager.deafened;
    this.muted = voiceManager.muted;
    this.voiceManager = voiceManager;
    if (voiceOptions.volume && voiceOptions.volume !== 100) this.volume = voiceOptions.volume;
  }

  /**
   * Sends server update to lavalink
   * @internal
   */
  public async sendServerUpdate(voiceManager: RainlinkVoiceManager): Promise<void> {
    const playerUpdate = {
      guildId: this.guildId,
      playerOptions: {
        voice: {
          token: voiceManager.serverUpdate!.token,
          endpoint: voiceManager.serverUpdate!.endpoint,
          sessionId: voiceManager.sessionId!,
        },
      },
    };
    await this.node.rest.updatePlayer(playerUpdate);
  }

  /**
   * Destroy the player
   * @internal
   */
  public async destroy(): Promise<void> {
    const voiceManager = this.manager.voiceManagers.get(this.guildId);
    if (voiceManager) {
      voiceManager.disconnect();
      this.manager.voiceManagers.delete(this.guildId);
    }
    await this.node.rest.destroyPlayer(this.guildId);
    this.manager.players.delete(this.guildId);
    this.state = RainlinkPlayerState.DESTROYED;
    this.debug('Player destroyed at ' + this.guildId);
    this.manager.emit(RainlinkEvents.PlayerDestroy, this);
  }

  /**
   * Play a track
   * @param track Track to play
   * @param options Play options
   * @returns RainlinkPlayer
   */
  public async play(track?: RainlinkTrack, options?: PlayOptions): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');

    if (track && !(track instanceof RainlinkTrack)) throw new Error('track must be a KazagumoTrack');

    if (!track && !this.queue.totalSize) throw new Error('No track is available to play');

    if (!options || typeof options.replaceCurrent !== 'boolean')
      options = { ...options, replaceCurrent: false };

    if (track) {
      if (!options.replaceCurrent && this.queue.current) this.queue.unshift(this.queue.current);
      this.queue.current = track;
    } else if (!this.queue.current) this.queue.current = this.queue.shift();

    if (!this.queue.current) throw new Error('No track is available to play');

    const current = this.queue.current;

    let errorMessage: string | undefined;

    const resolveResult = await current.resolver(this.manager).catch((e: any) => {
      errorMessage = e.message;
      return null;
    });

    if (!resolveResult) {
      this.manager.emit(RainlinkEvents.PlayerResolveError, this, current, errorMessage);
      this.manager.emit(RainlinkEvents.Debug, `Player ${this.guildId} resolve error: ${errorMessage}`);
      this.queue.current = null;
      this.queue.size ? await this.play() : this.manager.emit(RainlinkEvents.PlayerEmpty, this);
      return this;
    }

    const playOptions = { encoded: current.encoded, options: {} };
    if (options) playOptions.options = { ...options, noReplace: false };
    else playOptions.options = { noReplace: false };

    this.playing = true;

    this.playTrackEncoded(playOptions);

    return this;
  }

  /**
   * Set the loop mode of the track
   * @param mode Mode to loop
   * @returns RainlinkPlayer
   */
  public setLoop(mode: RainlinkLoopMode): RainlinkPlayer {
    this.loop = mode;
    return this;
  }

  /**
   * Search track directly from player
   * @param query The track search query link
   * @param options The track search options
   * @returns RainlinkSearchResult
   */
  public async search(query: string, options?: RainlinkSearchOptions): Promise<RainlinkSearchResult> {
    return await this.manager.search(query, options);
  }

  /**
   * Pause the track
   * @returns RainlinkPlayer
   */
  public async pause(): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    if (this.paused) return this;
    await this.node.rest.updatePlayer({
      guildId: this.guildId,
      playerOptions: {
        paused: true,
      },
    });
    this.paused = true;
    return this;
  }

  /**
   * Resume the track
   * @returns RainlinkPlayer
   */
  public async resume(): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    if (!this.paused) return this;
    await this.node.rest.updatePlayer({
      guildId: this.guildId,
      playerOptions: {
        paused: false,
      },
    });
    this.paused = false;
    return this;
  }

  /**
   * Play the previous track
   * @returns RainlinkPlayer
   */
  public async previous(): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    const prevoiusData = this.queue.previous;
    const current = this.queue.current;
    const index = prevoiusData.length - 1;
    if (index === -1 || !current) return this;
    await this.play(prevoiusData[index]);
    this.queue.previous.splice(index, 1);
    return this;
  }

  /**
   * Get all previous track
   * @returns RainlinkTrack[]
   */
  public getPrevious(): RainlinkTrack[] {
    return this.queue.previous;
  }

  /**
   * Skip the current track
   * @returns RainlinkPlayer
   */
  public async skip(): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    await this.node.rest.updatePlayer({
      guildId: this.guildId,
      playerOptions: {
        track: {
          encoded: null,
        },
      },
    });

    this.playing = false;
    this.position = 0;
    if (this.queue.current) this.queue.previous.push(this.queue.current);
    const currentSong = this.queue.current;
    this.queue.current = null;
    if (this.queue.length) this.manager.emit(RainlinkEvents.PlayerEnd, this, currentSong);
    else if (!this.queue.length) {
      this.manager.emit(RainlinkEvents.PlayerEmpty, this);
      return this;
    }

    this.play();
    this.paused = false;
    return this;
  }

  /**
   * Seek to another position in track
   * @param position Position to seek
   * @returns RainlinkPlayer
   */
  public async seek(position: number): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    if (!this.queue.current) throw new Error("Player has no current track in it's queue");
    if (!this.queue.current.isSeekable) throw new Error("The current track isn't seekable");

    position = Number(position);

    if (isNaN(position)) throw new Error('position must be a number');
    if (position < 0 || position > (this.queue.current.duration ?? 0))
      position = Math.max(Math.min(position, this.queue.current.duration ?? 0), 0);

    await this.node.rest.updatePlayer({
      guildId: this.guildId,
      playerOptions: {
        position: position,
      },
    });
    this.queue.current.position = position;
    return this;
  }

  /**
   * Set another volume in player
   * @param volume Volume to cange
   * @returns RainlinkPlayer
   */
  public async setVolume(volume: number): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    if (isNaN(volume)) throw new Error('volume must be a number');
    await this.node.rest.updatePlayer({
      guildId: this.guildId,
      playerOptions: {
        volume: volume,
      },
    });
    this.volume = volume;
    return this;
  }

  /**
   * Set player to mute or unmute
   * @param enable Enable or not
   * @returns RainlinkPlayer
   */
  public setMute(enable: boolean): RainlinkPlayer {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    if (enable == this.muted) return this;
    this.voiceManager.setDeaf(enable);
    return this;
  }

  /**
   * Set player to deaf or undeaf
   * @param enable Enable or not
   * @returns RainlinkPlayer
   */
  public setDeaf(enable: boolean): RainlinkPlayer {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    if (enable == this.deafened) return this;
    this.voiceManager.setDeaf(enable);
    return this;
  }

  /**
   * Disconnect from the voice channel
   * @returns RainlinkPlayer
   */
  public disconnect(): RainlinkPlayer {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    this.voiceManager.disconnect();
    this.pause();
    this.state = RainlinkPlayerState.DISCONNECTED;
    this.debug(`Player disconnected; Guild id: ${this.guildId}`);
    return this;
  }

  /**
   * Connect from the voice channel
   * @returns RainlinkPlayer
   */
  public async connect(): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    if (this.state === RainlinkPlayerState.CONNECTED || !!this.voiceId)
      throw new Error('Player is already connected');
    await this.voiceManager.connect();
    this.state = RainlinkPlayerState.CONNECTED;
    this.debug(`Player ${this.guildId} connected`);
    return this;
  }

  /**
   * Set text channel
   * @param textId Text channel ID
   * @returns KazagumoPlayer
   */
  public setTextChannel(textId: Snowflake): RainlinkPlayer {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    this.textId = textId;
    return this;
  }

  /**
   * Set voice channel and move the player to the voice channel
   * @param voiceId Voice channel ID
   * @returns KazagumoPlayer
   */
  public setVoiceChannel(voiceId: Snowflake): RainlinkPlayer {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');
    this.voiceId = voiceId;

    const voiceManager = this.manager.voiceManagers.get(this.guildId);

    if (voiceManager) {
      voiceManager.disconnect();
      this.manager.voiceManagers.delete(this.guildId);
    }

    const newVoiceManager = new RainlinkVoiceManager(this.manager, {
      guildId: this.guildId,
      voiceId: voiceId,
      textId: this.textId,
      shardId: this.voiceOptions.shardId,
      mute: this.muted,
      deaf: this.deafened,
    });

    this.voiceManager = newVoiceManager;

    this.debug(`Player ${this.guildId} moved to voice channel ${voiceId}`);

    return this;
  }

  /**
   * Set a filter that prebuilt in rainlink
   * @param filter The filter name
   * @returns KazagumoPlayer
   */
  public async setFilter(filter: keyof typeof RainlinkFilterData): Promise<RainlinkPlayer> {
    if (this.state == RainlinkPlayerState.DESTROYED) throw new Error('Player is already destroyed');

    const filterData = RainlinkFilterData[filter as keyof typeof RainlinkFilterData];

    if (!filterData) throw new Error('Filter not found');

    await this.send({
      guildId: this.guildId,
      playerOptions: {
        filters: filterData,
      },
    });

    return this;
  }

  /**
   * Send custom player update data to lavalink server
   * @param data Data to change
   * @returns RainlinkPlayer
   */
  public async send(data: UpdatePlayerInfo): Promise<RainlinkPlayer> {
    await this.node.rest.updatePlayer(data);
    return this;
  }

  /** @ignore */
  protected async playTrackEncoded(playable: PlayEncodedOptions): Promise<void> {
    const playerOptions: UpdatePlayerOptions = {
      track: {
        encoded: playable.encoded,
      },
    };
    if (playable.options) {
      const { pause, startTime, endTime, volume } = playable.options;
      if (pause) playerOptions.paused = pause;
      if (startTime) playerOptions.position = startTime;
      if (endTime) playerOptions.endTime = endTime;
      if (volume) playerOptions.volume = volume;
    }
    if (playerOptions.paused) this.paused = playerOptions.paused;
    if (playerOptions.position) this.position = playerOptions.position;
    if (playerOptions.volume) this.volume = playerOptions.volume;
    await this.node.rest.updatePlayer({
      guildId: this.guildId,
      noReplace: playable.options?.noReplace ?? false,
      playerOptions,
    });
  }

  /** @ignore */
  private debug(logs: string): void {
    this.manager.emit(RainlinkEvents.Debug, `[Rainlink Player]: ${logs}`);
  }
}
