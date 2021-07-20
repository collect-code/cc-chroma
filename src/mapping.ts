import { BigInt } from "@graphprotocol/graph-ts"
// Events
import { ChromaFive, Transfer } from "../generated/ChromaFive/ChromaFive"
// Entities
import { Token, User, Event } from "../generated/schema"


// Based on the Studio tutorial
//	https://www.youtube.com/watch?v=HfDgC2oNnwo
// Typescript library
//	https://github.com/graphprotocol/graph-ts

export function handleTransfer(event: Transfer): void {
	let tokenIdString = event.params.tokenId.toString();
	let token = Token.load(tokenIdString);
	let isNewToken = (!token);
	if(isNewToken) {
		// Every CHROMA contract has the exact same ABI
		let contract = ChromaFive.bind(event.address);
		let tokenSeries = contract.name();
		
		token = new Token(tokenSeries + '_' + tokenIdString);
		token.tokenId = event.params.tokenId;
		token.tokenSeries = tokenSeries;
		token.tokenName = tokenSeries + '#' + (tokenIdString.length==1?'0':'') + tokenIdString;
		token.mintTime = event.block.timestamp;
		token.creator = event.params.to.toHexString();

		updateTokenURI(token as Token, contract.tokenURI(event.params.tokenId));
		if(token.isBuilt) {
			token.buildTime = event.block.timestamp;
			token.builder = event.params.to.toHexString();
		}
	}
	token.owner = event.params.to.toHexString();
	token.save()

	let user = User.load(event.params.to.toHexString());
	if(!user) {
		user = new User(event.params.to.toHexString());
		user.save();
	}

	if(isNewToken) {
		createEvent('Mint', token as Token, event.block.timestamp);
	}
}

function updateTokenURI(token: Token, tokenURI: string): void {
	let pixelsPos = tokenURI.indexOf('pixels=');
	let pixels = (pixelsPos > 0 && tokenURI.length > pixelsPos+7) ? tokenURI.substr(pixelsPos+7) : '';
	let isBuilt = (pixels.length > 0);
	token.tokenURI = tokenURI;
	token.pixels = pixels;
	token.isSource = !isBuilt;
	token.isBuilt = isBuilt;
}

function createEvent(eventType: string, token: Token, time: BigInt): void {
	let ev = new Event(eventType+'_'+token.id);
	ev.eventType = eventType;
	ev.token = token.id;
	ev.time = time;
	ev.save();
}
