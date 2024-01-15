import asyncio
import base64
import database as db
import json
import os
import websockets

connections = []
lobbiesByIP = {}

# mainly to work around apache's mod_proxy
def getWebsocketIP(websocket):
	ip = websocket.remote_address[0]
	if (ip in ["::1", "127.0.0.1"] and "X-Forwarded-For" in websocket.request_headers):
		ip = websocket.request_headers["X-Forwarded-For"]
	return ip

def generateSecretId():
	return base64.b64encode(os.urandom(64)).decode("ascii")

async def clientConnection(websocket, path):
	connections.append(websocket)

	await websocket.send(json.dumps({
		"type": "lobbyList",
		"lobbies": db.getLobbies(0, 100) # if this ever reaches 100, pagination needs to be implemented
	}))

	async for message in websocket:
		data = json.loads(message)
		match data["type"]:
			case "openLobby":
				# check if request is valid
				if ("name" not in data or
					"userLimit" not in data or
					"hasPassword" not in data or
					"language" not in data or
					type(data["name"]) is not str or
					type(data["userLimit"]) is not int or
					type(data["hasPassword"]) is not bool or
					type(data["language"]) is not str or
					data["language"].lower() not in ["de", "en", "ja"]
				):
					await websocket.send('{"type": "error", "code": "invalidLobbyData", "request": "openLobby"}')
					break

				# check if this IP is allowed to open more lobbies
				ip = getWebsocketIP(websocket)
				if (lobbiesByIP.setdefault(ip, 0) == 5):
					await websocket.send('{"type": "error", "code": "lobbyLimitReached"}')
					break
				lobbiesByIP[ip] += 1

				# validate lobby name
				if (len(data["name"]) > 50):
					await websocket.send('{"type": "error", "code": "lobbyNameTooLong"}')
					break

				# generate secret ID for the lobby
				existingSecretIds = db.getSecretIds()
				secretId = generateSecretId()
				while (secretId in existingSecretIds):
					secretId = generateSecretId()

				db.openLobby(data["name"], data["language"], secretId, data["userLimit"], data["hasPassword"])

				await websocket.send(json.dumps({"type": "created", "secret": secretId}))
				websockets.broadcast(connections, json.dumps({
					"type": "lobbyOpened",
					"lobby": {
						"name": data["name"],
						"language": data["language"],
						"userCount": 1,
						"userLimit": data["userLimit"],
						"hasPassword": data["hasPassword"]
					}
				}))
				print("Opened new lobby: " + data["name"])
				break

			case "closeLobby":
				# check if secret was sent and is valid
				if ("secret" not in data or data["secret"] is not str):
					await websocket.send('{"type": "error", "code": "invalidLobbyData", "request": "closeLobby"}')
					break

				db.closeLobby(secretId)
				websockets.broadcast(connections, json.dumps({"type": "lobbyClosed"}))
				break

			case "setUserLimit":
				if ("newLimit" not in data or
					"secret" not in data or
					type(data["newLimit"]) is not int or
					type(data["secret"]) is not str
				):
					await websocket.send('{"type": "error", "code": "invalidLobbyData", "request": "setUserLimit"}')
					break

				db.setUserLimit(data["newLimit"], data["secret"])
				break

			case "setHasPassword":
				if ("hasPassword" not in data or
					"secret" not in data or
					type(data["hasPassword"]) is not bool or
					type(data["secret"]) is not str
				):
					await websocket.send('{"type": "error", "code": "invalidLobbyData", "request": "setUserLimit"}')
					break

			case _:
				await websocket.send('{"type": "error", "code": "unknownMessageType"}')
				break

	connections.remove(websocket)

print("Starting websocket...")
start_server = websockets.serve(clientConnection, "", 4538)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()