id: CUS00098
cardType: standardSpell
name: CUS00098
level: 1
types: Gravity

o: cast
after: COUNT(destroyed(dueTo: fight, by: types = Dragon & owner = you)) > 0
opponent.DAMAGE(100);