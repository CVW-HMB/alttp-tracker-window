'use strict';

$(function() {
	if (location.search === '') {
		window.open('./index.html?load','Berserker\'s Tracker by GGW','directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no');
		return;
	}
	$('body').css('display', 'block');
	const configurable = {};
	
	const zoomer = new Zoomer();
	new Tooltip();
	const connectorLines = new ConnectorLines();
	const mover = new Mover();
	const resizer = new Resizer();
	const settings = new Settings();
	// the one record of collected checks; the maps, the text boxes, the
	// auto-tracker and the Checks box all work through it
	const checks = new Checks();

	const menuEl = $('.menu-container')[0];

	for (const trackerEl of $('.map-tracker')) {
	  trackerEl.appendChild(menuEl.cloneNode(true));
	  const tracker = new MapTracker(trackerEl, zoomer, settings, checks);
	  const id = trackerEl.id;
	  configurable[id] = tracker;
	}
	const connectors = $('#connectors')[0];
	for (const icon of $(menuEl).find('.icon[data-connector="true"]')) {
	  connectors.appendChild(icon.cloneNode(true));
	}

	$('body').on('click', '#connectors .icon', e => {
		const icon = e.target.closest('.icon');
		if (icon) {
			$(icon).toggleClass('used');
		}
	});
	
	menuEl.remove();
	

	const oneMap = new OneMap(settings);
	const textTracker = new TextTracker(settings, checks);
	const autoTracker = new AutoTracker(settings, textTracker, checks);
	new CheckPanel(checks, settings);
	Object.assign(configurable, { settings, mover, resizer, zoomer, textTracker, checks });

	const config = new Config(configurable);
	window.download = () => config.download();
	window.trackerConfig = config;
	window.checks = checks;

	const coop = new Coop(configurable, config, settings);
	new CoopUI(coop);
	$('#load-button').on('click', () => coop.setLoaded());
	$('#load-button').on('click', () => setTimeout(() => connectorLines.refreshAvailability(), 0));
	window.connectorLines = connectorLines;
	$('#menu-button').on('click', e => { e.stopPropagation(); $('#menu-panel').toggleClass('coop-hidden'); });
	$('#menu-panel').on('click', e => e.stopPropagation());
	$(document).on('click', () => $('#menu-panel').addClass('coop-hidden'));
	$('#export-settings').on('click', () => $('#menu-panel').addClass('coop-hidden'));
	configurable.coop = coop;
	window.coop = coop;
	$('#end-race-yes').on('click', () => coop.leave());
});
