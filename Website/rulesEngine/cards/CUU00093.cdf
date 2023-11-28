id: CUU00093
cardType: unit
name: CUU00093
level: 6
types: Fire, Earth, Bug
attack: 600
defense: 600

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
both.DISCARD(DECKTOP?(2));

o: trigger
mandatory: no
condition: [from discarded where self = thisCard & zone = [deck, field]]
cost:
LOSELIFE(100);
exec:
$cards = SELECT(2, [from discard]);
MOVE($cards + thisCard, baseOwner.deck);