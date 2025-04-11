import type { RainlinkNodeOptions } from "../Interface/Manager";
import { AbstractLibrary } from "./AbstractLibrary";

export class ErisJS extends AbstractLibrary {
	public sendPacket(shardId: number, payload: any, important: boolean): void {
		void this.client.shards.get(shardId)?.sendWS(payload.op, payload.d, important);
	}

	public getId(): string {
		return this.client.user.id;
	}

	public getShardCount(): number {
		return this.client.shards?.size ? this.client.shards.size : 1;
	}

	public listen(nodes: RainlinkNodeOptions[]): void {
		this.client.once("ready", () => this.ready(nodes));
		this.client.on("rawWS", (packet: any) => this.raw(packet));
	}
}
