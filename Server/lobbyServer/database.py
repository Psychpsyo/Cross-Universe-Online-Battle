import math
import sqlite3
import time

con = sqlite3.connect("database.db", check_same_thread = False)
cur = con.cursor()

# initialize database
cur.execute("""CREATE TABLE IF NOT EXISTS lobbies(
	secret_id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	language TEXT NOT NULL,
	user_count INTEGER DEFAULT 1 NOT NULL,
	user_limit INTEGER NOT NULL,
	has_password INTEGER NOT NULL,
	last_keepalive INTEGER NOT NULL
)""")
con.commit()

# functions to access database
# open a new lobby
def openLobby(name, language, secretId, userLimit, hasPassword):
	cur.execute("INSERT INTO lobbies (name, language, secret_id, user_limit, has_password, last_keepalive) VALUES (?, ?, ?, ?, ?, ?)", (name, language, secretId, userLimit, hasPassword, math.floor(time.time())))
	con.commit()

# close a given lobby
def closeLobby(secretId):
	cur.execute("DELETE FROM lobbies WHERE host_password = ?", (secretId))
	con.commit()

# set the user limit for a given lobby
def setUserLimit(newLimit, secretId):
	cur.execute("UPDATE lobbies SET user_limit = ? WHERE host_password = ?", (newLimit, secretId))
	con.commit()

# set the user limit for a given lobby
def setUserCount(newCount, secretId):
	cur.execute("UPDATE lobbies SET user_count = ? WHERE host_password = ?", (newCount, secretId))
	con.commit()

# reset the keepAlive for a given lobby
def keepAlive(secretId):
	cur.execute("UPDATE lobbies SET last_keepalive = ? WHERE host_password = ?", (math.floor(time.time()), secretId))
	con.commit()

# get a list of all current lobbies
def getLobbies(page, perPage):
	lobbies = []
	for guess in cur.execute("SELECT name, language, user_count, user_limit, has_password FROM lobbies ORDER BY user_count DESC LIMIT ? OFFSET ?", (perPage, page * perPage)):
		lobbies.append({
			"name": guess[0],
			"language": guess[1],
			"userCount": guess[2],
			"userLimit": guess[3],
			"hasPassword": guess[4] == 1
		})
	return lobbies

def getSecretIds():
	secretIds = []
	for id in cur.execute("SELECT secret_id FROM lobbies"):
		secretIds.append(id)
	return secretIds