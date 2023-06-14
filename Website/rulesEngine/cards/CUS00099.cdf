id: CUS00099
cardType: standardSpell
name: CUS00099
level: 0
types:
o: cast
cost:
DISCARD(SELECT(4, [card from yourHand]))
exec:
DESTROY([card from field])