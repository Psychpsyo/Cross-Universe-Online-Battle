id: CUU00109
cardType: unit
name: CUU00109
level: 2
types: Ice, Warrior
attack: 200
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
$views = VIEW(opponent.DECKTOP(2));
$toExile = SELECT(1, $views.viewed);
EXILE($toExile);
MOVE($views.viewed - $toExile, opponent.deckTop);

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
APPLY(thisCard, {attack += 100}, endOfTurn);