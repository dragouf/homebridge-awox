# homebridge-awox
control awox smartlight with homebridge


### config :

```
  {
     "accessory": "AwoxSmartLight",
     "name": "My Lamp",
     "lampMac": "d03972b84926"
    },

```

with mqtt state
```
  {
      "accessory": "AwoxSmartLight",
      "name": "My Lamp",
      "lampMac": "d03972b84926",
      "mqttServer": ""mqtt://192.168.1.12",
      "mqttTopicRoot": "/awox",
      "mqttUsername": "",
      "mqttPassword": ""
    },

```
