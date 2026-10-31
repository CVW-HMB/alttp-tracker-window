var autotrackHost = null;
var autotrackSocket = null;
var autotrackDeviceName = "";

var autotrackReconnectTimer = null;
var autotrackTimer = null;

var autotrackPrevData = null;

var autotrackRefreshInterval = 1000;
var autotrackTimeoutDelay = 10000;

var WRAM_START = 0xF50000;
var WRAM_SIZE = 0x20000;
var SAVEDATA_START = WRAM_START + 0xF000;
var SAVEDATA_SIZE = 0x500;

let port = null;

let collect = () => {};
let setitem = () => {};

class AutoTracker {
  #settings = null;

  constructor(settings, textTracker, checks) {
    this.#settings = settings;

	// a check seen in the save file goes into the one check record; the text
	// boxes, the map chests and the Checks box all follow from there
	collect = name => checks.collect(name);
	setitem = (item, value) => textTracker.setItem(item, value);
	
	$('#load-button').on('click', () => {
	  this.loadSettings();
	});
  }
  
  loadSettings() {
    const settings = this.#settings.getSettings();
	
	port = parseInt(settings.autoTrackingPort);
	// OK Dude can be pressed again (co-op presses it for a joiner): a live or
	// pending connection is kept, never toggled off from here
	if (port > 0 && settings.autoTracking && autotrackSocket === null && autotrackReconnectTimer === null) {
	  autotrackConnect("ws://localhost:" + port);
	}
  }
  
}

function autotrackStartTimer() {
    autotrackTimer = setTimeout(autotrackReadMem, autotrackRefreshInterval);
}

function autotrackSetStatus(text) {
    document.getElementById("autotrackingstatus").textContent = "Autotracking Status: " + text;
}

function autotrackConnect(host) {	
    if (autotrackSocket !== null || autotrackReconnectTimer !== null) {
        autotrackDisconnect();
        return;
    }

    autotrackHost = host;
    autotrackSocket = new WebSocket(host);
    autotrackSocket.binaryType = 'arraybuffer';

    autotrackSocket.onclose = function(event) {
        autotrackCleanup();
        autotrackSetStatus("Disconnected: " + event.reason);
    }

    autotrackSocket.onerror = function(event) {
        autotrackCleanup();
        autotrackSetStatus("Error");
    }
    
    autotrackSocket.onopen = autotrackOnConnect;
    
    autotrackSetStatus("Connecting");
    //document.getElementById("autoTrackButton").textContent="Disconnect";

    autotrackReconnectTimer = setTimeout(function () {
        autotrackReconnectTimer = null;
        autotrackCleanup();
        autotrackConnect(autotrackHost);
    }, autotrackTimeoutDelay);
}

function autotrackDisconnect() {
    if (autotrackReconnectTimer !== null) {
        clearTimeout(autotrackReconnectTimer);
        autotrackReconnectTimer = null;
    }
    autotrackCleanup();
    //document.getElementById("autoTrackButton").textContent="Connect";
}

function autotrackCleanup() {
    if (autotrackTimer !== null) {
        clearTimeout(autotrackTimer);
        autotrackTimer = null;
    }
    if (autotrackSocket !== null) {
        autotrackSocket.onopen = function () {};
        autotrackSocket.onclose = function () {};
        autotrackSocket.onmessage = function () {};
        autotrackSocket.onerror = function () {};
        autotrackSocket.close();
        autotrackSocket = null;
    }

    autotrackPrevData = null;
    //autotrackSetStatus("Disconnected");
}

function autotrackOnConnect(event) {
    autotrackSetStatus("Connected, requesting devices list");

    autotrackSocket.send(JSON.stringify({
        Opcode: "DeviceList",
        Space: "SNES"
    }));
    autotrackSocket.onmessage = autotrackOnDeviceList;
}

function autotrackOnDeviceList(event) {
    var results = JSON.parse(event.data).Results;
    if (results.length < 1) {
        autotrackCleanup();
        autotrackSetStatus("No device found");
        return;
    }
    autotrackDeviceName = results[0];

    autotrackSocket.send(JSON.stringify({
        Opcode : "Attach",
        Space : "SNES",
        Operands : [autotrackDeviceName]
    }));
    autotrackSetStatus("Connected to " + autotrackDeviceName);

    autotrackStartTimer();
}

function autotrackReadMem() {
    function snesread(address, size, callback) {
        autotrackSocket.send(JSON.stringify({
            Opcode : "GetAddress",
            Space : "SNES",
            Operands : [address.toString(16), size.toString(16)]
        }));
        autotrackSocket.onmessage = callback;
    };

    if (autotrackReconnectTimer !== null)
        clearTimeout(autotrackReconnectTimer);
    autotrackReconnectTimer = setTimeout(function () {
        autotrackReconnectTimer = null;
        autotrackCleanup();
        autotrackConnect(autotrackHost);
    }, autotrackTimeoutDelay);
    
    snesread(WRAM_START + 0x10, 1, function (event) {
        var gamemode = new Uint8Array(event.data)[0];
        if (![0x07, 0x09, 0x0b].includes(gamemode)) {
            autotrackStartTimer();
            return;
        }
        snesread(SAVEDATA_START, 0x280, function (event2) {
            snesread(SAVEDATA_START + 0x280, 0x280, function (event3) {
                var data = new Uint8Array([...new Uint8Array(event2.data), ...new Uint8Array(event3.data)]);
                autotrackDoTracking(data);
                autotrackPrevData = data;
                autotrackStartTimer();
            });
        });
    });
}

function autotrackDoTracking(data) {
    function changed(offset) {
        return autotrackPrevData === null || autotrackPrevData[offset] !== data[offset];
    };
    function disabledbit(offset, mask) {
        return (data[offset] & mask) === 0 && (autotrackPrevData === null || ((autotrackPrevData[offset] & mask) !== 0));
    };
    function newbit(offset, mask) {
        return (data[offset] & mask) !== 0 && (autotrackPrevData === null || ((autotrackPrevData[offset] & mask) !== (data[offset] & mask)));
    };
    // every item check of the game has a flag in the save file (js/locations.js);
    // a flag that just came on is a check just collected, dungeons included
    for (const location of LOCATIONS) {
        if (newbit(location.sram[0], location.sram[1]))
            collect(location.name);
    }

	if (changed(0x343)) // Bombs
        setitem("bomb", data[0x343] > 0);

    if (changed(0x3C5) && data[0x3C5] >= 3) // Agahnim Killed
        setitem("agahnim", true);

    if (newbit(0x38E, 0x80))
        setitem("bow", 1); // Bow
    if (newbit(0x38E, 0x40))
        setitem("bow", 2); // Silvers

    if (newbit(0x38C, 0xC0)) {
        var bits = data[0x38C] & 0xC0;
        setitem("boomerang", bits == 0x80 ? 1 : (bits == 0x40 ? 2 : 3));
    }

    if (disabledbit(0x38C, 0x20))
        setitem("mushroom", false);
    if (newbit(0x38C, 0x20)) {
        setitem("mushroom", true);
	}
    if (newbit(0x38C, 0x10)) {
        setitem("powder", true);
	}

    if (newbit(0x38C, 0x04)) {
        setitem("shovel", true);
	}
    if (newbit(0x38C, 0x03))
        setitem("flute", true);

    if (newbit(0x342, 0x01))
        setitem("hookshot", true);

    if (newbit(0x345, 0x01))
        setitem("firerod", true);

    if (newbit(0x346, 0x01))
        setitem("icerod", true);

    if (newbit(0x347, 0x01))
        setitem("bombos", true);

    if (newbit(0x348, 0x01))
        setitem("ether", true);

    if (newbit(0x349, 0x01))
        setitem("quake", true);

    if (newbit(0x34A, 0x01))
        setitem("lantern", true);

    if (newbit(0x34B, 0x01))
        setitem("hammer", true);

    if (newbit(0x34D, 0x01))
        setitem("net", true);

    if (newbit(0x34E, 0x01))
        setitem("book", true);

    if (newbit(0x350, 0x01))
        setitem("somaria", true);

    if (newbit(0x351, 0x01))
        setitem("byrna", true);

    if (newbit(0x352, 0x01))
        setitem("cape", true);

    if (newbit(0x353, 0x02))
        setitem("mirror", true);

    if (newbit(0x355, 0x01))
        setitem("boots", true);

    if (newbit(0x356, 0x01))
        setitem("flippers", true);

    if (newbit(0x357, 0x01))
        setitem("moonpearl", true);

    if (changed(0x354))
        setitem("glove", data[0x354]);

    if (changed(0x359))
        setitem("sword", (data[0x359] == 0xFF) ? 0 : data[0x359]);

    if (changed(0x35A))
        setitem("shield", data[0x35A]);

    if (changed(0x35B))
        setitem("tunic", data[0x35B] + 1);

    if (changed(0x37B))
        setitem("magic", data[0x37B] > 0);
	
    var prevbottles = -1;
    if (autotrackPrevData !== null)
        prevbottles = (autotrackPrevData[0x35C] == 0 ? 0 : 1) + (autotrackPrevData[0x35D] == 0 ? 0 : 1) + (autotrackPrevData[0x35E] == 0 ? 0 : 1) + (autotrackPrevData[0x35F] == 0 ? 0 : 1);
    var bottles = (data[0x35C] == 0 ? 0 : 1) + (data[0x35D] == 0 ? 0 : 1) + (data[0x35E] == 0 ? 0 : 1) + (data[0x35F] == 0 ? 0 : 1);
    if (bottles != prevbottles) {
        setitem("bottle", bottles);
	}
}
