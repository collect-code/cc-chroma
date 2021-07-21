import { BigInt, Address } from "@graphprotocol/graph-ts"
// Events
import { ChromaFive, Transfer, BuildCodeCall } from "../generated/ChromaFive/ChromaFive"
// Entities
import { Token, User, Event } from "../generated/schema"


// Based on the Studio tutorial
//	https://www.youtube.com/watch?v=HfDgC2oNnwo
// Typescript library
//	https://github.com/graphprotocol/graph-ts

export function handleTransfer(event: Transfer): void {
	// Every CHROMA contract has the exact same ABI
	let contract = ChromaFive.bind(event.address);
	let tokenSeries = contract.name();
	let tokenIdString = event.params.tokenId.toString();

	let tokenKey = tokenSeries + '_' + tokenIdString;
	let token = Token.load(tokenKey);
	if(!token) {
		token = new Token(tokenKey);
		token.contractAddress = event.address;
		token.tokenSeries = tokenSeries;
		token.tokenId = event.params.tokenId;
		token.tokenName = tokenSeries + '#' + (tokenIdString.length==1?'0':'') + tokenIdString;
		token.mintTime = event.block.timestamp;
		token.creator = event.params.to.toHexString();

		if(updateTokenURI(token as Token, contract.tokenURI(token.tokenId))) {
			token.buildTime = event.block.timestamp;
			token.builder = event.params.to.toHexString();
		}

		createEvent('Mint', token as Token, event.block.timestamp);
	}
	token.owner = event.params.to.toHexString();
	token.save()

	let user = User.load(event.params.to.toHexString());
	if(!user) {
		user = new User(event.params.to.toHexString());
		user.save();
	}
}

export function handleBuildCode(call: BuildCodeCall): void {
	let token = Token.load(call.inputs.tokenId.toString());
	if(token) {
		let contract = ChromaFive.bind(token.contractAddress as Address);
		if(updateTokenURI(token as Token, contract.tokenURI(token.tokenId))) {
			token.buildTime = call.block.timestamp;
			token.builder = token.owner;
			token.save()
			createEvent('Build', token as Token, call.block.timestamp);
		}
	}
}

function updateTokenURI(token: Token, tokenURI: string): boolean {
	let pixelsPos = tokenURI.indexOf('pixels=');
	let pixels = (pixelsPos > 0 ? tokenURI.substr(pixelsPos+7) : '');
	let isBuilt = (pixels.length > 0);
	token.tokenURI = tokenURI;
	token.pixels = pixels;
	token.isSource = !isBuilt;
	token.isBuilt = isBuilt;
	return isBuilt;
}

function createEvent(eventType: string, token: Token, time: BigInt): void {
	let ev = new Event(eventType+'_'+token.id);
	ev.eventType = eventType;
	ev.token = token.id;
	ev.time = time;
	ev.save();
}
