const { Rainlink, Library } = require("../dist");
const { Client, GatewayIntentBits } = require("discord.js");
const { Guilds, GuildVoiceStates, GuildMessages, MessageContent } = GatewayIntentBits;
const Tester = require("./tester");
require("dotenv").config();

const tester = new Tester();
const { token } = process.env;
const Nodes = [
	{
		name: "owo",
		host: process.env.v4_host,
		port: 8888,
		auth: "youshallnotpass",
		driver: "frequenc/v1/miku"
	}
];

async function run() {
	class EditedClient extends Client {
		rainlink = new Rainlink({
			library: new Library.DiscordJS(this),
			options: {
				defaultSearchEngine: "youtube"
			},
			nodes: Nodes
		});
	}
	const client = new EditedClient({ intents: [Guilds, GuildVoiceStates, GuildMessages, MessageContent] });

	await tester.testCase("Connecting to voice server", async () => {
		client.login(token);
		const connectChecking = await new Promise((resolve, reject) => {
			client.rainlink.on("nodeConnect", () => resolve("localPass"));
			client.rainlink.on("nodeDisconnect", () => reject(new Error("Cannot connect")));
			client.rainlink.on("nodeError", () => reject(new Error("Cannot connect")));
		});

		return connectChecking;
	});

	await tester.testCase("Search tracks (title)", async () => {
		const data = await client.rainlink.search("Primary/yuiko - in the Garden");
		tester.debug(`<DATA> | Type: ${data.type}, Tracks: ${data.tracks.length}`);
		return data.tracks.length !== 0 ? "localPass" : false;
	});

	await tester.testCase("Decode track (server side)", async () => {
		const data = await client.rainlink.search("Primary/yuiko - in the Garden");
		tester.debug(`<DATA> | Type: ${data.type}, Tracks: ${data.tracks.length}`);
		const { encoded } = data.tracks[0].raw;
		const testingId = data.tracks[0].identifier;
		const res = await client.rainlink.nodes.full.at(0)[1].rest.decodeTrack(encoded);
		tester.debug(
			`<DATA> | Title: ${res ? res.info.title : "!FAILED!"}, Author: ${res ? res.info.author : "!FAILED!"}, URI: ${res ? res.info.uri : "!FAILED!"}`
		);
		return res.info.identifier === testingId ? "localPass" : false;
	});

	await tester.testCase("Decode track (client side)", async () => {
		const data = await client.rainlink.search("Primary/yuiko - in the Garden");
		tester.debug(`<DATA> | Type: ${data.type}, Tracks: ${data.tracks.length}`);
		const { encoded } = data.tracks[0].raw;
		const testingId = data.tracks[0].identifier;
		const res = await client.rainlink.nodes.full.at(0)[1].driver.functions.get("decode")(encoded);
		tester.debug(
			`<DATA> | Title: ${res ? res.info.title : "!FAILED!"}, Author: ${res ? res.info.author : "!FAILED!"}, URI: ${res ? res.info.uri : "!FAILED!"}`
		);
		return res.info.identifier === testingId ? "localPass" : false;
	});

	await tester.testCase("Connect to discord voice", async () => {
		const isPass = await client.rainlink
			.create({
				guildId: "1027945618347397220",
				textId: "1163101075100946572",
				voiceId: "1239150964284461086",
				shardId: 0,
				volume: 100
			})
			.then(() => "localPass")
			.catch(() => false);
		return isPass;
	});

	await tester.testCase("Disconnect to discord voice", async () => {
		const isPass = await client.rainlink.players
			.destroy("1027945618347397220")
			.then(() => "localPass")
			.catch(() => false);
		return isPass;
	});

	tester.printSummary();
	process.exit(0);
}

run();
