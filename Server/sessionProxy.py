# This used to be the proxy server for the entire game.
# It now only acts as the signalling server for room code battles.
# That's why it does a bit more than it needs to in some places.

import asyncio
import websockets
from datetime import datetime

roomLock = asyncio.Lock()
rooms = {}

#websocket function
async def clientConnection(websocket, path):
	roomcode = ""
	try:
		async for message in websocket:
			async with roomLock:
				if message.startswith("[roomcode]"):
					if roomcode != "":
						await websocket.send("[quit]alreadyInRoom")
						break

					# also trims roomcode to 5000 characters
					roomcode = message[10:5010]

					#is roomcode empty?
					if roomcode == "":
						await websocket.send("[quit]emptyRoomcode")
						break

					#is roomcode already open?
					if roomcode in rooms:
						#how many players are in the room?
						if len(rooms[roomcode]["playerSockets"]) < 2:
							rooms[roomcode]["playerSockets"].append(websocket)
							await rooms[roomcode]["playerSockets"][0].send("[youAre]0")
							await rooms[roomcode]["playerSockets"][0].send("[playerFound]")
							await rooms[roomcode]["playerSockets"][1].send("[youAre]1")
							await rooms[roomcode]["playerSockets"][1].send("[playerFound]")
						else:
							await websocket.send("[quit]roomFull")
							break
					else:
						#open room with the requested room code
						rooms[roomcode] = {"playerSockets":[websocket]}
						print("[" + str(datetime.now()) + "] Opening new room. (" + str(len(rooms.keys())) + " total)")
				else: #expecting regular message
					#message not [roomcode] and no roomcode given disconnects the client TODO: more friendly solution
					if roomcode == "":
						await websocket.send("[quit]noRoomcode")
						break

					if len(rooms[roomcode]["playerSockets"]) != 2:
						roomLock.release()
						await websocket.send("[err]noOpponent")
						continue

					#we have a roomcode and a message, forward it!
					await rooms[roomcode]["playerSockets"][1 - rooms[roomcode]["playerSockets"].index(websocket)].send(message)
	except:
		pass

	async with roomLock:
		if roomcode in rooms and websocket in rooms[roomcode]["playerSockets"]:
			#remove client from room
			rooms[roomcode]["playerSockets"].remove(websocket)
			#if they were the last one in the room, get rid of the room
			if len(rooms[roomcode]["playerSockets"]) == 0:
				del rooms[roomcode]
				print("[" + str(datetime.now()) + "] Shutting down a room. (" + str(len(rooms.keys())) + " total)")
			else:
				#for now, this just makes the other client quit as well
				await rooms[roomcode]["playerSockets"][0].send("[quit]opponentGone")

print("Starting websocket...")
start_server = websockets.serve(clientConnection, "", 4539)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()