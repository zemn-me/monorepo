
Airlock Loadout
=============================================================================================================

Airlock Loadout is an electronic display intended to be placed by the exit to a building. Using weather data,
it indicates what clothing or accessories might be necessary for the climate outside.

The project is based on this [Weather Gadget].

[Weather Gadget]: https://gist.github.com/dmi3/26d3924f5b4600e5dc5197d1c3da7f43

Bill of Materials
-------------------------------------------------------------------------------------------------------------

Kind | Item | Cost
---  | ---- | -----
E-ink Display | [LILYGO® TTGO T5s 2.7inch E-Paper ESP32 Wireless Module For Alexa I2S DAC MAX98357A MEMS Microphone ICS43434 Development Board] | $17.49
Battery | [1PCS 503035 3.7v 500mah lithium polymer battery 3 7V volt li po ion lipo rechargeable batteries for dvd GPS navigation] | $3.44
Case | [Small Clear Storage Box Rectangle Display Case Dustproof Protection Model Toy Jewelry collection box Cotton swab box] | $1.13
  Total  |     |   $22.06

[Small Clear Storage Box Rectangle Display Case Dustproof Protection Model Toy Jewelry collection box Cotton swab box]: https://www.aliexpress.us/item/2255800617543109.html?gatewayAdapt=glo2usa4itemAdapt&_randl_shipto=US

[LILYGO® TTGO T5s 2.7inch E-Paper ESP32 Wireless Module For Alexa I2S DAC MAX98357A MEMS Microphone ICS43434 Development Board]: https://www.aliexpress.us/item/2251832681565906.html?gatewayAdapt=glo2usa4itemAdapt&_randl_shipto=US
[1PCS 503035 3.7v 500mah lithium polymer battery 3 7V volt li po ion lipo rechargeable batteries for dvd GPS navigation]: https://www.aliexpress.us/item/3256801298813235.html?spm=a2g0s.9042311.0.0.27424c4doq4loC&aff_fcid=1727dc9b46ce4d4ba5fbd5186e8c92d7-1677967912894-01105-_9iWuaM&aff_fsk=_9iWuaM&aff_platform=portals-tool&sk=_9iWuaM&aff_trace_key=1727dc9b46ce4d4ba5fbd5186e8c92d7-1677967912894-01105-_9iWuaM&terminal_id=9274e91618204b8eb9a2bbc8a2a8e0b5&afSmartRedirect=y&gatewayAdapt=glo2usa4itemAdapt&_randl_shipto=US

Firmware
-------------------------------------------------------------------------------------------------------------

[Rust](https://github.com/esp-rs)

Security
-------------------------------------------------------------------------------------------------------------

* **OTA (Over-The-Air) Updates**
    * The ESP32 supports a form of network-based firmware update ([docs](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/ota.html)).
* **Local network**
    * The device exposes no local network function.





