id: CUS00190
cardType: standardSpell
name: CUS00190
level: 0
types: Illusion

o: cast
condition: [from you.partnerZone].types = Illusion & [from you.partnerZone].cardType = unit
cost:
DISCARD(SELECT(1, [from you.hand where types = Illusion]));
exec:
APPLY(SELECT(1, [from opponent.field where cardType = unit & level < 4]), {cancel abilities}, endOfTurn);