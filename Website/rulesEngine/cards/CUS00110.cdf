id: CUS00110
cardType: standardSpell
name: CUS00110
level: 1
types:
o: cast
cost:
LIFE(-800)
exec:
SUMMON(SELECT(1, [from yourHand where level < 8 & types != Light]), yourField, no)