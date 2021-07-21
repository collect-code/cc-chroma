import { BigInt, Address } from "@graphprotocol/graph-ts"
// Events
import { ChromaFive, Transfer, BuildCodeCall } from "../generated/ChromaFive/ChromaFive"
// Entities
import { Token, User, Event, Attributes } from "../generated/schema"


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
		let tokenInfo = contract.getTokenInfo(event.params.to, event.params.tokenId);

		token = new Token(tokenKey);
		token.contractAddress = event.address;
		token.tokenSeries = tokenSeries;
		token.tokenId = event.params.tokenId;
		token.tokenName = tokenSeries + '#' + (tokenIdString.length==1?'0':'') + tokenIdString;
		token.mintTime = event.block.timestamp.plus(tokenInfo.sequenceNumber);
		token.creator = event.params.to.toHexString();

		// Build info
		if(updateTokenURI(token as Token, contract.tokenURI(token.tokenId))) {
			token.buildTime = token.mintTime;
			token.builder = event.params.to.toHexString();
		}

		// Create attributes
		let order: string[] = ['First','Second','Third','Fourth','Fifth'];
		let offspring: string[] = ['Single','Twins','Triplets','Quadruplets','Quintuplets'];
		let attr = new Attributes(tokenKey);
		attr.isSource = token.isSource;
		attr.isBuilt = token.isBuilt;
		attr.siblingNumber = (tokenInfo.sequenceNumber.toI32() == 0 ? 1 : tokenInfo.sequenceNumber.toI32());
		attr.siblingCount = (tokenInfo.sequenceTokens.length == 0 ? 1 : tokenInfo.sequenceTokens.length);
		attr.siblingOrder = (attr.siblingCount > 1 ? order[attr.siblingNumber-1] : null);
		attr.offspring = offspring[attr.siblingCount-1];
		attr.save()
		token.attributes = attr.id;

		// Create internal event
		createEvent('Mint', token as Token, token.mintTime);
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
	let contract = ChromaFive.bind(call.to);
	let tokenKey = contract.name() + '_' + call.inputs.tokenId.toString();
	let token = Token.load(tokenKey);
	if(token) {
		if(updateTokenURI(token as Token, contract.tokenURI(token.tokenId))) {
			token.buildTime = call.block.timestamp;
			token.builder = token.owner;
			token.save()
			// Update attributes
			let attr = Attributes.load(tokenKey);
			if(attr) {
				attr.isSource = token.isSource;
				attr.isBuilt = token.isBuilt;
				attr.save()
			}
			// Create internal event
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
