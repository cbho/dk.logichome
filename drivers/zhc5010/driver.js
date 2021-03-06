'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

module.exports = new ZwaveDriver(path.basename(__dirname), {
	debug: true,
	capabilities: {
		onoff: {
			command_class: 'COMMAND_CLASS_BASIC',
			command_set: 'BASIC_SET',
			command_set_parser: value => ({
				'Value': value
			}),
			command_get: 'BASIC_GET',
			command_report: 'BASIC_REPORT',
			command_report_parser: (report, node) => {
				if (report.hasOwnProperty('Current Value')) {
					// module.exports.realtime(node.device_data, 'dim', (report['Current Value'] === 255 ? 1.0 : 0.0));
					return report['Current Value'] !== 0;
				};
				if (report.hasOwnProperty('Value')) {
					// module.exports.realtime(node.device_data, 'dim', (report['Value'] === 255 ? 1.0 : 0.0));
					return report['Value'] !== 0;
				};
				return null;
			}
		},
		dim: [{
				command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
				command_get: 'SWITCH_MULTILEVEL_GET',
				command_set: 'SWITCH_MULTILEVEL_SET',
				command_set_parser: (value, node) => {
					module.exports.realtime(node.device_data, 'onoff', value > 0);
					return {
						'Value': value * 100,
						'Dimming Duration': 'Default',
					};
				},
				command_report: 'SWITCH_MULTILEVEL_SET',
				command_report_parser: (report, node) => {
					if (report.Value === 'on/enable') {
						module.exports.realtime(node.device_data, 'onoff', true);
						return 1.0;
					}
					else if (report.Value === 'off/disable') {
						module.exports.realtime(node.device_data, 'onoff', false);
						return 0.0;
					}
					else if (typeof report.Value === 'number') {
						module.exports.realtime(node.device_data, 'onoff', report.Value > 0);
						return report.Value / 99;
					}
					else if (typeof report['Value (Raw)'] !== 'undefined') {
						module.exports.realtime(node.device_data, 'onoff', report['Value (Raw)'][0] > 0);
						if (report['Value (Raw)'][0] === 255) return 1.0;
						return report['Value (Raw)'][0] / 99;
					}
					return null;
				},
		},
			{
				command_class: 'COMMAND_CLASS_SWITCH_BINARY',
				command_report: 'SWITCH_BINARY_SET',
				command_report_parser: (report, node) => {
					if (report['Switch Value'] === 'on/enable') {
						module.exports.realtime(node.device_data, 'onoff', true);
						return 1.0;
					}
					else if (report['Switch Value'] === 'off/disable') {
						module.exports.realtime(node.device_data, 'onoff', false);
						return 0.0;
					}
					else if (typeof report['Switch Value'] === 'number') {
						module.exports.realtime(node.device_data, 'onoff', report['Switch Value'] > 0);
						return report['Switch Value'] / 99;
					}
					else if (typeof report['Switch Value (Raw)'] !== 'undefined') {
						module.exports.realtime(node.device_data, 'onoff', report['Switch Value (Raw)'][0] > 0);
						if (report['Switch Value (Raw)'][0] === 255) return 1.0;
						return report['Switch Value (Raw)'][0] / 99;
					}
					return null;
				}
		}
	]
	},
	settings: {
		1: {
			index: 1,
			size: 1
		},
		2: {
			index: 2,
			size: 1
		},
		3: {
			index: 3,
			size: 1
		},
		4: {
			index: 4,
			size: 1
		},
		5: {
			index: 5,
			size: 1
		},
		6: {
			index: 6,
			size: 1
		},
		7: {
			index: 7,
			size: 1
		},
		8: {
			index: 8,
			size: 1
		},
		9: {
			index: 9,
			size: 1
		},
		10: {
			index: 10,
			size: 1
		},
		11: {
			index: 11,
			size: 1
		},
		12: {
			index: 12,
			size: 1
		},
		13: {
			index: 13,
			size: 1
		},
		14: {
			index: 14,
			size: 1
		},
		15: {
			index: 15,
			size: 1
		},
		16: {
			index: 16,
			size: 1
		},
		17: {
			index: 17,
			size: 1,
			signed: false,
		},
		18: {
			index: 18,
			size: 1
		},
		23: {
			index: 23,
			size: 1
		},
		24: {
			index: 24,
			size: 1
		},
		25: {
			index: 25,
			size: 1
		},
		26: {
			index: 26,
			size: 1
		}
	}
});

// bind Flow
module.exports.on('initNode', (token) => {
	const node = module.exports.nodes[token];

	var lastReceivedSequenceNumber = null;
	if (node && typeof node.instance.CommandClass.COMMAND_CLASS_CENTRAL_SCENE !== 'undefined') {
		node.instance.CommandClass.COMMAND_CLASS_CENTRAL_SCENE.on('report', (command, report) => {
			if (command.name === 'CENTRAL_SCENE_NOTIFICATION' &&
				report &&
				report.hasOwnProperty('Properties1') &&
				report.Properties1.hasOwnProperty('Key Attributes') &&
				report.hasOwnProperty('Scene Number') &&
				report.hasOwnProperty('Sequence Number') &&
				(!lastReceivedSequenceNumber || report['Sequence Number'] !== lastReceivedSequenceNumber)) {

				lastReceivedSequenceNumber = report['Sequence Number'];
				Homey.manager('flow').triggerDevice('zhc5010_scene', null, {
					button: report['Scene Number'].toString(),
					scene: report.Properties1['Key Attributes']
				}, node.device_data);
			}
		});
	}
});

Homey.manager('flow').on('trigger.zhc5010_scene', (callback, args, state) => {
	if (args && state) {
		return callback(null, state.button === args.button && state.scene === args.scene);
	}
});

Homey.manager('flow').on('action.zhc5010_set_led_level', (callback, args) => {
	if (args && args.device && args.device.token && args.led &&
		typeof args.level === 'number') {

		const node = module.exports.nodes[args.device.token];

		if (node &&
			node.instance &&
			node.instance.CommandClass &&
			node.instance.CommandClass.COMMAND_CLASS_INDICATOR &&
			node.instance.CommandClass.COMMAND_CLASS_INDICATOR.version === 2) {

			// Send parameter values to module
			node.instance.CommandClass.COMMAND_CLASS_INDICATOR.INDICATOR_SET({
				"Indicator 0 Value": 'off/disable',
				"Properties1": {
					"Indicator Object Count": 1,
					"Reserved": 0
				},
				"vg1": [
					{
						"Indicator ID": args.led,
						"Property ID": 'Multilevel',
						"Value": args.level
          }
        ]
			}, (err, result) => {

				// If error, stop flow card
				if (err) {
					Homey.error(err);
					return callback(null, false);
				}

				// If properly transmitted
				if (result === "TRANSMIT_COMPLETE_OK") {
					return callback(null, true);
				}

				// no transmition, stop flow card
				return callback(null, false);
			});
		}
		else return callback('missing COMMAND_CLASS_INDICATOR_V2');

	}
	else return callback('invalid_device');
});

Homey.manager('flow').on('action.zhc5010_set_led_flash', (callback, args) => {
	console.log(args)
	if (args && args.device && args.device.token && args.led &&
		typeof args.level === 'number' &&
		typeof args.on_off_period === 'number' &&
		typeof args.on_off_cycles === 'number') {

		const node = module.exports.nodes[args.device.token];

		if (node &&
			node.instance &&
			node.instance.CommandClass &&
			node.instance.CommandClass.COMMAND_CLASS_INDICATOR &&
			node.instance.CommandClass.COMMAND_CLASS_INDICATOR.version === 2) {

			// Send parameter values to module
			node.instance.CommandClass.COMMAND_CLASS_INDICATOR.INDICATOR_SET({
				"Indicator 0 Value": 'off/disable',
				"Properties1": {
					"Indicator Object Count": 3,
					"Reserved": 0
				},
				"vg1": [
					{
						"Indicator ID": args.led,
						"Property ID": 'Multilevel',
						"Value": args.level
          },
					{
						"Indicator ID": args.led,
						"Property ID": 'On_Off_Period',
						"Value": args.on_off_period * 10
          },
					{
						"Indicator ID": args.led,
						"Property ID": 'On_Off_Cycles',
						"Value": args.on_off_cycles
          }
        ]
			}, (err, result) => {

				// If error, stop flow card
				if (err) {
					Homey.error(err);
					return callback(null, false);
				}

				// If properly transmitted
				if (result === "TRANSMIT_COMPLETE_OK") {
					return callback(null, true);
				}

				// no transmition, stop flow card
				return callback(null, false);
			});
		}
		else return callback('missing COMMAND_CLASS_INDICATOR_V2');

	}
	else return callback('invalid_device');
});
