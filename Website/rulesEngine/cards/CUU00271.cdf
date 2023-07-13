id: CUU00271
cardType: unit
name: CUU00271
level: 2
types: Light
attack: 0
defense: 0
o: trigger
mandatory: yes
after: targeted = thisCard
DRAW(1)
o: trigger
mandatory: yes
after: destroyed = thisCard
LOSELIFE(300)