id: CUS00186
cardType: standardSpell
name: CUS00186
level: 0
types: Water

o: cast
RETURN(opponent.SELECT(1, [from opponent.discard]), baseOwner.deck);
GAINLIFE(200);

o: trigger
mandatory: no
after: discarded(from: deck) = thisCard
cost:
EXILE([from discard where self = thisCard]);
exec:
RETURN(SELECT(1, [from you.discard where types = Water]), baseOwner.deckBottom);