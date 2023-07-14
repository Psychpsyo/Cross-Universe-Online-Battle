id: CUS00110
cardType: standardSpell
name: CUS00110
level: 1
types:
o: cast
cost:
LOSELIFE(800)
exec:
SUMMON(SELECT(1, [from you.hand where level < 8 & types != Light]), you.unitZone, no)