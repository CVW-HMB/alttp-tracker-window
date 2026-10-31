To download/install:

1. Go to the releases table.

2. Download source file zip.

3. Unzip into a folder.

------

How to run:

1. Open index.html in a web browser.
   In windows, this usually can be done by right clicking -> Open With -> Some Web Browser

2. The browser will likely warn you that the page is trying to open a pop-up. Allow this pop up to be created.
   You may have to refresh the page if it warns you about the pop-up. It will open the tracker in a new window.

3. Pick whatever options you care about. The tracker comes with built-in defaults, there is no config file to load.

4. OK DUDE

------

Layout:

After you load the tracker, the map and text boxes may not be positioned ideally for you. You can move the boxes around by dragging the title or green box. You can zoom with +/-. The blue box will change the dimension of the boxes when you click and drag it.

Once things are where you want them, open the Menu (top right) and press Update defaults. The tracker will start like that from then on. Export settings downloads that setup as a file if you want to move it to another computer; load it with "Import a settings file" on the settings screen. Your race progress is not part of that file.

------

Progress:

Everything you do is saved in the browser after every change. Close the tab, close the browser, crash, whatever: open the page again and press Resume. Refreshing the page picks up where you were on its own.

End race (bottom right) clears the board and takes you back to the settings screen. It asks first. The race you just ended can be brought back from the settings screen if you change your mind.

------

Auto tracking:

Auto tracking sees every check in the game, dungeons included. When you pick something up the text box for it is marked off and the Checks box goes down by one. Obviously if you do not pick up an item (i.e from catfish), it will not mark it off automatically.

The Checks box shows how many checks are left in five groups: overworld, single item caves, multi item caves, drop downs and dungeons. They add up to all 216. Each number has arrows if you need to fix it by hand. The chests the map starts with each stand on a check: the chest disappears when that check is done, and right clicking a chest marks it done yourself. A numbered chest (1, 2 or 5) you put down elsewhere and later right click off the map lowers the count by that many when auto tracking is off. With auto tracking on it does not, since the game reports those chests itself.

------

Spoiler logs:

Paste or load a spoiler on the settings screen: an alttpr.com spoiler (the JSON from the seed page, crosskeys included) or a Door Randomizer log. Shuffled entrances and dungeon prizes are placed on the maps for you.

Visit marks puts an orange box on every map icon. Left click an icon to clear its box once you have been there. Shift+click still opens the icon menu. Works with or without a spoiler.

------

Co-op:

Two people, one board, over the internet. Nothing to host or install. One person hosts, the other joins, and you trade two short codes in Discord or any chat. The board is shared along with the host's spoiler and visit marks setting. Your own layout, panels and auto tracking stay yours, and pickups from either game show up on both trackers.

------

Connector lines:

The Menu has a toggle that draws coloured lines between the entrances of each connector cave. Hover a connector in the Connectors box to see just that one, with a green ring where it sits on the map. Both maps need to be on screen.

------

I do not recommend using most of the location text box trackers unless you also use auto-tracking. It will likely be overwhelming to track.

------

Only tested this on chrome. Good luck with other browsers.

------

Auto-tracking Resources:

http://usb2snes.com/ - has links to all auto tracking resources

https://skarsnik.github.io/QUsb2snes/ - qusb2snes (it works with emulator and sd2snes).

https://github.com/RedGuyyyy/sd2snes/releases - firmware (if you are using sd2snes)

https://drive.google.com/drive/folders/1_ej-pwWtCAHYXIrvs5Hro16A1s9Hi3Jz - snes9x 1.6x with lua scripting support
