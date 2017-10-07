var Accessory, Service, Characteristic, UUIDGen;
var AwoxSmartLight = require('awox-smartlight');
var Accessory, Service, Characteristic, UUIDGen;
var mqtt = require('mqtt')

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerAccessory("homebridge-awox", "AwoxSmartLight", AwoxAccessory, true);
}

function AwoxAccessory(log, config) {
  this.log = log;
  this.config = config || {};
  this.name = config["name"];
  this.bulbName = config["bulbName"] || config["name"];
  this.lampMac = config["lampMac"];
  this.mqttServer = config["mqttServer"];
  this.mqttTopic = config["mqttTopicRoot"];
  this.service = new Service.Lightbulb(this.name);
  this.hasMqtt = !!config["mqttServer"];

  this.on = false;
  this.brightness = 100;
  this.hue = 0;
  this.saturation = 0;

  this.lamp = new AwoxSmartLight(this.lampMac, this.log);

  this.client_Id = 'awox_' + Math.random().toString(16).substr(2, 8);
  this.options = {
		keepalive: 10,
		clientId: this.client_Id,
		protocolId: 'MQTT',
		protocolVersion: 4,
		clean: true,
		reconnectPeriod: 1000,
		connectTimeout: 30 * 1000,
		will: {
			topic: 'WillMsg',
			payload: 'Connection Closed abnormally..!',
			qos: 0,
			retain: false
		},
		username: config["mqttUsername"],
		password: config["mqttPassword"],
		rejectUnauthorized: false
	};

  this.service
    .getCharacteristic(Characteristic.On)
    .on('get', this.getPower.bind(this))
    .on('set', this.setPower.bind(this));

  this.service
    .getCharacteristic(Characteristic.Brightness)
    .on('get', this.getBrightness.bind(this))
    .on('set', this.setBrightness.bind(this));
  this.service
    .getCharacteristic(Characteristic.Hue)
    .on('get', this.getHue.bind(this))
    .on('set', this.setHue.bind(this));
  this.service
    .getCharacteristic(Characteristic.Saturation)
    .on('get', this.getSaturation.bind(this))
    .on('set', this.setSaturation.bind(this));
}

AwoxAccessory.prototype.getPower = function(callback) {
    if(this.hasMqtt) {
      this.readMqtt("power", this.on, (result) => {
        this.log("(mqtt) Power state for the '%s' is %s", this.name, result);
        callback(null, result === 'true');
      });
    } else {
      this.log("Power state for the '%s' is %s", this.name, this.on);
      callback(null, this.on);
    }
}

AwoxAccessory.prototype.setPower = function(powerOn, callback) {
  //var lamp = new AwoxSmartLight(this.lampMac, this.log);
  this.log("Set power state on the '%s' to %s", this.bulbName, powerOn);
  if(powerOn) {
    this.lamp.lightOn();
  }
  else {
    this.lamp.lightOff();
  }

  this.on = !powerOn;

  this.writeMqtt("power", powerOn);

  callback();
}

AwoxAccessory.prototype.getBrightness = function(callback) {
  if(this.hasMqtt) {
    this.readMqtt("brightness", this.brightness, (result) => {
      this.log("(mqtt) brightness for the '%s' is %s", this.name, result);
      callback(null, parseFloat(result));
    });
  } else {
    this.log("brightness for the '%s' is %s", this.name, this.brightness);
    callback(null, this.brightness);
  }
}

AwoxAccessory.prototype.setBrightness = function(brightness, callback, context) {
	if(context !== 'fromSetValue') {
    this.log("set brightness to:" + brightness);
    this.writeMqtt("brightness", brightness);
		this.brightness = brightness;
    this.lamp.lightBrightness(brightness / 100);
	}
	callback();
}

AwoxAccessory.prototype.getHue = function(callback) {
  if(this.hasMqtt) {
    this.readMqtt("hue", this.hue, (result) => {
      this.log("(mqtt) hue for the '%s' is %s", this.name, result);
      callback(null, parseFloat(result));
    });
  } else {
    this.log("hue for the '%s' is %s", this.name, this.hue);
    callback(null, this.hue);
  }
}

AwoxAccessory.prototype.setHue = function(hue, callback, context) {
	if(context !== 'fromSetValue') {
    this.writeMqtt("hue", hue);
		this.hue = hue;
    var rgb = this._hsvToRgb(hue, this.saturation, this.brightness);
    //var r = this._decToHex(rgb.r);
    //var g = this._decToHex(rgb.g);
    //var b = this._decToHex(rgb.b);
    this.lamp.lightRgbReset();
    this.lamp.lightRgb(rgb.r, rgb.g, rgb.b, false);
	}
	callback();
}

AwoxAccessory.prototype.getSaturation = function(callback) {
  if(this.hasMqtt) {
    this.readMqtt("saturation", this.saturation, (result) => {
      this.log("saturation for the '%s' is %s", this.name, result);
      callback(null, parseFloat(result));
    });
  } else {
    this.log("saturation for the '%s' is %s", this.name, this.saturation);
    callback(null, this.saturation);
  }
}

AwoxAccessory.prototype.setSaturation = function(saturation, callback, context) {
	if(context !== 'fromSetValue') {
    this.writeMqtt("saturation", saturation);
    this.log("set saturation to:" + saturation);
		this.saturation = saturation;
    //this.lamp.lightWhiteReset();
    this.lamp.lightWhite(saturation / 100);
	}
	callback();
}

AwoxAccessory.prototype.writeMqtt = function(key, value)
{
    var logger = this.log;
    var topic = this.mqttTopic + "/" + this.lampMac + "/" + key;
    var client  = mqtt.connect(this.mqttServer, this.options);

    logger("publishing to: '" + topic + "' value: " + value);

    client.on('connect', () => {
      client.publish(topic, value.toString(), {
        retain: true
      }, () => client.end());
    });
}

AwoxAccessory.prototype.readMqtt = function(key, defaultValue, callback)
{
    var logger = this.log;

    var requestTopic = this.mqttTopic + "/" + this.lampMac + "/" + key;
    var client  = mqtt.connect(this.mqttServer, this.options);

    client.on('connect', () => {
      client.subscribe(requestTopic);
    });

    var timeout = setTimeout(() => {
      logger("read mqtt timeout for " + key);
      client.end();
      callback(defaultValue);
    }, 2000);

    var count = 0;
    client.on('message', (topic, message) => {
      if(topic === requestTopic && count == 0) {
        count++;
        clearTimeout(timeout);
        callback(message.toString());
        client.end();
      }
    });
}

AwoxAccessory.prototype._hsvToRgb = function(h, s, v) {
    var r, g, b, i, f, p, q, t;

    h /= 360;
    s /= 100;
    v /= 100;

    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    var rgb = { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    return rgb;
}

AwoxAccessory.prototype._decToHex = function(d, padding) {
    var hex = Number(d).toString(16).toUpperCase();
    padding = typeof (padding) === 'undefined' || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = '0' + hex;
    }

    return hex;
}

AwoxAccessory.prototype.getServices = function() {
    return [this.service];
}
