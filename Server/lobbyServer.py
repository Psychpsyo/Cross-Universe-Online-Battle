import asyncio
import json
import websockets
from collections import ChainMap;

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
	if "newCount" not in data or type(data["newCount"]) is not int:
		await websocket.send('{"type": "error", "code": "invalidUserCount"}')
		return

	hostedLobby = connectionData[websocket]["hostedLobby"]
	if hostedLobby == None:
		await websocket.send('{"type": "error", "code": "cannotSetUserCountOnNone"}')
		return

	hostedLobby["data"]["userCount"] = data["newCount"]
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyUserCountChanged",
		"lobbyId": hostedLobby["data"]["id"],
		"newCount": data["newCount"]
	}))

# client wants to set user limit on its lobby
async def setUserLimit(websocket, data):
	if "newLimit" not in data or type(data["newLimit"]) is not int:
		await websocket.send('{"type": "error", "code": "invalidUserLimit"}')
		return

	hostedLobby = connectionData[websocket]["hostedLobby"]
	if hostedLobby == None:
		await websocket.send('{"type": "error", "code": "cannotSetUserLimitOnNone"}')
		return

	hostedLobby["data"]["userLimit"] = data["newLimit"]
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyUserLimitChanged",
		"lobbyId": hostedLobby["data"]["id"],
		"newLimit": data["newLimit"]
	}))

# client wants to adjust password status on its lobby
async def setHasPassword(websocket, data):
	if "newHasPassword" not in data or type(data["newHasPassword"]) is not bool:
		await websocket.send('{"type": "error", "code": "invalidHasPassword"}')
		return

	hostedLobby = connectionData[websocket]["hostedLobby"]
	if hostedLobby == None:
		await websocket.send('{"type": "error", "code": "cannotSetHasPasswordOnNone"}')
		return

	hostedLobby["data"]["hasPassword"] = data["newHasPassword"]
	websockets.broadcast(connections, json.dumps({
		"type": "lobbyHasPasswordChanged",
		"lobbyId": hostedLobby["data"]["id"],
		"newHasPassword": data["newHasPassword"]
	}))

async def joinLobby(websocket, data):
	try:
		lobby = next(lobby for lobby in allLobbies if lobby["data"]["id"] == data["lobbyId"])
		if lobby["data"]["userCount"] >= lobby["data"]["userLimit"]:
			await websocket.send('{"type": "error", "code": "cannotJoinFullLobby"}')
			return
		connectionData[lobby["host"]]["incomingPeers"].append(websocket)
		await lobby["host"].send(json.dumps({
			"type": "joinRequest",
			"sdp": data["sdp"]
		}))
	except Exception as e:
		await websocket.send('{"type": "error", "code": "cannotJoinInvalidLobby"}')

async def joinLobbyAnswer(websocket, data):
	if len(connectionData[websocket]["incomingPeers"]) == 0:
		await websocket.send('{"type": "error", "code": "noWaitingPeers"}')
		return

	peer = connectionData[websocket]["incomingPeers"].pop(0)
	await peer.send(json.dumps({
		"type": "joinRequestAnswer",
		"sdp": data["sdp"]
	}))

socketFunctions = {
	"openLobby": openLobby,
	"closeLobby": closeLobby,
	"setUserCount": setUserCount,
	"setUserLimit": setUserLimit,
	"setHasPassword": setHasPassword,
	"joinLobby": joinLobby,
	"joinLobbyAnswer": joinLobbyAnswer
}

async def clientConnection(websocket):
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
			print(data)
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