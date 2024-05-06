# This is the server code responsible for handling the webRTC signalling for lobbies.

import asyncio
import json
import websockets

connections = []
connectionData = {}
lobbiesByIP = {}
allLobbies = []

lastLobbyId = 0

# mainly to work around apache's mod_proxy
def getWebsocketIP(websocket):
	ip = websocket.remote_address[0]
	if (ip in ["::1", "127.0.0.1"] and "X-Forwarded-For" in websocket.request_headers):
		ip = websocket.request_headers["X-Forwarded-For"]
	return ip

# removes a lobby
def removeLobby(lobby):
	allLobbies.remove(lobby)
	websockets.broadcast(connections, json.dumps({"type": "lobbyClosed", "lobbyId": lobby["data"]["id"]}))
	hostIP = getWebsocketIP(lobby["host"])
	lobbiesByIP[hostIP] -= 1
	if lobbiesByIP[hostIP] == 0: # clean up so we don't leak memory (or GDPR violations)
		del lobbiesByIP[hostIP]



# client wants to open a lobby
async def openLobby(websocket, data):
	global lastLobbyId
	# check if request is valid
	if ("name" not in data or
		"userCount" not in data or
		"userLimit" not in data or
		"hasPassword" not in data or
		"language" not in data or
		type(data["name"]) is not str or
		type(data["userCount"]) is not int or
		type(data["userLimit"]) is not int or
		type(data["hasPassword"]) is not bool or
		type(data["language"]) is not str or
		data["language"].lower() not in ["de", "en", "ja"]
	):
		await websocket.send('{"type": "error", "code": "invalidLobbyData", "request": "openLobby"}')
		return

	# check if this IP is allowed to open more lobbies
	ip = getWebsocketIP(websocket)
	if lobbiesByIP.setdefault(ip, 0) == 5 or next((lobby for lobby in allLobbies if lobby["host"] == websocket), None) != None:
		await websocket.send('{"type": "error", "code": "lobbyLimitReached"}')
		return
	lobbiesByIP[ip] += 1

	# validate lobby name
	if len(data["name"]) > 50:
		await websocket.send('{"type": "error", "code": "lobbyNameTooLong"}')
		return

	lastLobbyId += 1
	hostedLobby = {
		"host": websocket,
		"data": {
			"id": lastLobbyId,
			"name": data["name"],
			"language": data["language"],
			"userCount": data["userCount"],
			"userLimit": data["userLimit"],
			"hasPassword": data["hasPassword"]
		}
	}

	allLobbies.append(hostedLobby)
	connectionData[websocket]["hostedLobby"] = hostedLobby

	await websocket.send(json.dumps({"type": "created", "data": hostedLobby["data"]}))
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyOpened",
		"lobby": hostedLobby["data"]
	}))
	print("Opened lobby #" + str(lastLobbyId) + ": " + data["name"])

# client wants to close its lobby
async def closeLobby(websocket, data):
	if connectionData[websocket]["hostedLobby"] == None:
		await websocket.send('{"type": "error", "code": "cannotCloseNone"}')
		return
	removeLobby(connectionData[websocket]["hostedLobby"])

async def setUserCount(websocket, data):
	if "newValue" not in data or type(data["newValue"]) is not int:
		await websocket.send('{"type": "error", "code": "invalidUserCount"}')
		return

	hostedLobby = connectionData[websocket]["hostedLobby"]
	if hostedLobby == None:
		await websocket.send('{"type": "error", "code": "cannotSetUserCountOnNone"}')
		return

	hostedLobby["data"]["userCount"] = data["newValue"]
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyUserCountChanged",
		"lobbyId": hostedLobby["data"]["id"],
		"newValue": data["newValue"]
	}))

# client wants to set user limit on its lobby
async def setUserLimit(websocket, data):
	if "newValue" not in data or type(data["newValue"]) is not int or data["newValue"] < 1 or data["newValue"] > 1000:
		await websocket.send('{"type": "error", "code": "invalidUserLimit"}')
		return

	hostedLobby = connectionData[websocket]["hostedLobby"]
	if hostedLobby == None:
		await websocket.send('{"type": "error", "code": "cannotSetUserLimitOnNone"}')
		return

	hostedLobby["data"]["userLimit"] = data["newValue"]
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyUserLimitChanged",
		"lobbyId": hostedLobby["data"]["id"],
		"newValue": data["newValue"]
	}))

# client wants to adjust password status on its lobby
async def setHasPassword(websocket, data):
	if "newValue" not in data or type(data["newValue"]) is not bool:
		await websocket.send('{"type": "error", "code": "invalidHasPassword"}')
		return

	hostedLobby = connectionData[websocket]["hostedLobby"]
	if hostedLobby == None:
		await websocket.send('{"type": "error", "code": "cannotSetHasPasswordOnNone"}')
		return

	hostedLobby["data"]["hasPassword"] = data["newValue"]
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyHasPasswordChanged",
		"lobbyId": hostedLobby["data"]["id"],
		"newValue": data["newValue"]
	}))

# client wants to adjust password status on its lobby
async def setName(websocket, data):
	if "newValue" not in data or type(data["newValue"]) is not str:
		await websocket.send('{"type": "error", "code": "invalidName"}')
		return

	hostedLobby = connectionData[websocket]["hostedLobby"]
	if hostedLobby == None:
		await websocket.send('{"type": "error", "code": "cannotSetNameOnNone"}')
		return

	hostedLobby["data"]["name"] = data["newValue"].strip()[:100]
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyNameChanged",
		"lobbyId": hostedLobby["data"]["id"],
		"newValue": hostedLobby["data"]["name"]
	}))

async def joinLobbyOffer(websocket, data):
	try:
		lobby = next(lobby for lobby in allLobbies if lobby["data"]["id"] == data["lobbyId"])
		if lobby["data"]["userCount"] >= lobby["data"]["userLimit"]:
			await websocket.send('{"type": "error", "code": "cannotJoinFullLobby"}')
			return

		# fill first empty slot in connectionData[lobby["host"]]["incomingPeers"] with websocket or append it to the end
		addedIndex = -1
		for i in range(len(connectionData[lobby["host"]]["incomingPeers"])):
			if connectionData[lobby["host"]]["incomingPeers"][i] == None:
				connectionData[lobby["host"]]["incomingPeers"][i] = websocket
				addedIndex = i
				break
		if addedIndex == -1:
			addedIndex = len(connectionData[lobby["host"]]["incomingPeers"])
			connectionData[lobby["host"]]["incomingPeers"].append(websocket)

		await lobby["host"].send(json.dumps({
			"type": "joinRequestOffer",
			"peer": addedIndex,
			"sdp": data["sdp"]
		}))
	except Exception as e:
		await websocket.send('{"type": "error", "code": "cannotJoinInvalidLobby"}')

async def joinLobbyAnswer(websocket, data):
	if type(data["peer"]) is not int or data["peer"] < 0:
		await websocket.send('{"type": "error", "code": "invalidPeer"}')
		return
	if data["peer"] >= len(connectionData[websocket]["incomingPeers"]) or connectionData[websocket]["incomingPeers"][data["peer"]] == None:
		await websocket.send('{"type": "error", "code": "noWaitingPeer"}')
		return

	peer = connectionData[websocket]["incomingPeers"][data["peer"]]
	await peer.send(json.dumps({
		"type": "joinRequestAnswer",
		"sdp": data["sdp"]
	}))

async def joinLobbyOfferIceCandidate(websocket, data):
	try:
		lobby = next(lobby for lobby in allLobbies if lobby["data"]["id"] == data["lobbyId"])
		if websocket not in connectionData[lobby["host"]]["incomingPeers"]:
			await websocket.send('{"type": "error", "code": "cannotSendIceCandidateToLobbyYouAreNotJoining"}')
			return
		await lobby["host"].send(json.dumps({
			"type": "joinRequestOfferIceCandidate",
			"peer": connectionData[lobby["host"]]["incomingPeers"].index(websocket),
			"candidate": data["candidate"]
		}))
	except Exception as e:
		await websocket.send('{"type": "error", "code": "cannotJoinInvalidLobby"}')

async def joinLobbyAnswerIceCandidate(websocket, data):
	if type(data["peer"]) is not int or data["peer"] < 0:
		await websocket.send('{"type": "error", "code": "invalidPeer"}')
		return
	if data["peer"] >= len(connectionData[websocket]["incomingPeers"]) or connectionData[websocket]["incomingPeers"][data["peer"]] == None:
		await websocket.send('{"type": "error", "code": "peerNotWaiting"}')
		return

	peer = connectionData[websocket]["incomingPeers"][data["peer"]]
	await peer.send(json.dumps({
		"type": "joinRequestAnswerIceCandidate",
		"candidate": data["candidate"]
	}))

async def allIcesSent(websocket, data):
	if type(data["peer"]) is not int or data["peer"] < 0:
		await websocket.send('{"type": "error", "code": "invalidPeer"}')
		return
	if data["peer"] >= len(connectionData[websocket]["incomingPeers"]) or connectionData[websocket]["incomingPeers"][data["peer"]] == None:
		await websocket.send('{"type": "error", "code": "peerNotWaiting"}')
		return
	connectionData[websocket]["incomingPeers"][data["peer"]] = None

socketFunctions = {
	"openLobby": openLobby,
	"closeLobby": closeLobby,
	"setUserCount": setUserCount,
	"setUserLimit": setUserLimit,
	"setHasPassword": setHasPassword,
	"setName": setName,
	"joinLobbyOffer": joinLobbyOffer,
	"joinLobbyAnswer": joinLobbyAnswer,
	"joinLobbyOfferIceCandidate": joinLobbyOfferIceCandidate,
	"joinLobbyAnswerIceCandidate": joinLobbyAnswerIceCandidate,
	"allIcesSent": allIcesSent
}

async def clientConnection(websocket, path):
	global allLobbies
	connections.append(websocket)

	connectionData[websocket] = {
		"hostedLobby": None,
		"incomingPeers": []
	}

	await websocket.send(json.dumps({
		"type": "lobbyList",
		"lobbies": [lobby["data"] for lobby in allLobbies]
	}))

	try:
		async for message in websocket:
			data = json.loads(message)
			if (data["type"] in socketFunctions):
				await socketFunctions[data["type"]](websocket, data)
			else:
				await websocket.send('{"type": "error", "code": "unknownMessageType"}')
	except websockets.exceptions.ConnectionClosedError:
		pass
	except Exception as e:
		print(e)

	connections.remove(websocket)
	# remove hosted lobby when client disconnects
	if connectionData[websocket]["hostedLobby"]:
		removeLobby(connectionData[websocket]["hostedLobby"])

print("Starting websocket...")
start_server = websockets.serve(clientConnection, "", 4538)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()