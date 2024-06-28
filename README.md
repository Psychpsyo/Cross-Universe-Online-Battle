# Cross Universe Online Battle
This is the frontend for the website running at https://battle.crossuniverse.net.

## Contributing Code
I am open to contributions of any kind but please ask beforehand, in case it is something that is already being worked on or something that would bring larger changes to the codebase with it.  
To do this, you can simply [open an issue](https://github.com/Psychpsyo/Cross-Universe-Online-Frontend/issues/new).  
This way you'll know your PR can get accepted once you submit it.  

This doesn't apply to minor bugfixes, you'll probably be fine without coordinating those in advance.

## Contributing Translations
If you are looking to translate this site, you can find the translation files in [Website/data/locales](https://github.com/Psychpsyo/Cross-Universe-Online-Frontend/tree/main/Website/data/locales)  

The English file (en.json) is in this case the original and will always be complete and up-to-date.  
The Japanese file (ja.json) is still missing quite a bit. (The keys are in there but their value is just `null`.)  

To update the translation, just fork this repo, make your changes and open a pull request.  

Note:  
Some lines include things like `{#COUNT}`. Those will be replaced with actual numbers by the game and need to be exactly the same in the translated version. (Though you can move them to different points in the sentence.)

### Languages other than English and Japanese

I'm open to adding more languages than just English and Japanese but keep in mind that the game and rules currently only exist in those two and I have no authority over additional languages for that.

## Development Setup
1. Fork and clone this repo to your machine.
2. Install [python](https://www.python.org/downloads/).
3. Run `pythonServer.bat` (or `pythonServer.sh` on linux) from the `Website` folder.
4. Point your browser to `http://localhost:8000/`.

## LICENSE

Even though the code in this repo is licensed under the MIT License, the copyright for the Cross Universe card game itself belongs to [Cross Universe](https://crossuniverse.jp/).  
That means the MIT license cannot cover parts of the game itself such as the logo, card backs and field graphic.  
Those fall under Cross Universe's own license which can be found here:  
English: https://crossuniverse.net/tos/  
Japanese: https://crossuniverse.jp/約束事/

Similarly, the fonts in ``Website/fonts/`` are not covered by the MIT license either. Their licenses can be found here:  
Atkinson Hyperlegible: [Atkinson Hyperlegible Font License](http://brailleinstitute.org/wp-content/uploads/2020/11/Atkinson-Hyperlegible-Font-License-2020-1104.pdf)  
OpenDyslexic: [SIL-OFL License](https://github.com/antijingoist/opendyslexic/blob/master/OFL.txt)

These things are included in this repo despite that since the site and code would break without them.
