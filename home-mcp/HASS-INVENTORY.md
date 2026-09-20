# Home Assistant Inventory

> Working checklist for building comprehensive LLM support in the Home MCP.

**Captured:** 2026-09-08 14:49 PDT
**Source:** live Home Assistant inventory via the administrative HASS MCP
**Coverage:** 499 devices, 304 configured integrations, 14 installed apps/add-ons

## How to use this checklist

- Mark `[x]` when the Home MCP has comprehensive semantic support for the item, not merely generic state access.
- Keep device-level support separate from integration-level support: an integration can be supported while individual device behaviors remain incomplete.
- Device IDs and config-entry IDs are included for future implementation and diagnostics work.
- This is an inventory snapshot. Re-run the live inventory before relying on it for current production state.

## Summary

| Category | Count |
|---|---:|
| Devices | 499 |
| Configured integrations | 304 |
| Installed apps/add-ons | 14 |

## Home MCP capability progress

| Done | Capability | Coverage | Grounding / corpus |
|---|---|---|---|
| [x] | Household lights | Room groups and named fixtures; compound on/off; exact and relative brightness; configured RGB/white-temperature color; whole-home room summaries with one- or multi-room fixture detail follow-ups; state, history, cautious cause evidence, and Presence-Based Lighting status; embedded clarification/continuation controls with one-send persistence; sanitized serial conversation-learning queue with routing provenance, frozen replays, and guarded patch releases | `corpus/GEMINI-LIGHTS-GROUNDING.md`; deterministic 10k-utterance-per-family generator; `improvement/` |
| [ ] | Contact sensors | Not planned yet | — |

A capability check means the initial end-to-end MCP, chat-control, context,
corpus, and focused-test path exists. Individual device/integration boxes below
remain open until their complete family-specific behavior has been reviewed.

## Installed apps / add-ons

| Done | App | Slug | Version | State | Repository |
|---|---|---|---|---|---|
| [ ] | **Get HACS** — The easiest way to get HACS for Home Assistant | `cb646a50_get` | `1.3.1` | `stopped` | `cb646a50` |
| [ ] | **Advanced SSH & Web Terminal** — A supercharged SSH & Web Terminal access to your Home Assistant instance | `a0d7b954_ssh` | `24.1.3` | `started` | `a0d7b954` |
| [ ] | **Homebridge** — Homebridge - HomeKit support for the impatient | `0656e7b8_homebridge` | `2026-09-02` | `started` | `0656e7b8` |
| [ ] | **Home-Assistant-Matter-Hub** — Publish your entities from Home Assistant to any Matter-compatible controller like Alexa, Apple Home or Google Home. | `491eb00d_hamh` | `3.0.4` | `started` | `491eb00d` |
| [ ] | **Mosquitto broker** — An Open Source MQTT broker | `core_mosquitto` | `7.1.0` | `started` | `core` |
| [ ] | **Zigbee2MQTT** — Use your ZigBee devices without the vendor's bridge or gateway | `45df7312_zigbee2mqtt` | `2.14.1-1` | `started` | `45df7312` |
| [ ] | **Terminal & SSH** — Allow logging in remotely to Home Assistant using SSH | `core_ssh` | `10.4.0` | `stopped` | `core` |
| [ ] | **File editor** — Simple browser-based file editor for Home Assistant | `core_configurator` | `6.1.0` | `started` | `core` |
| [ ] | **Samba share** — Expose Home Assistant folders with SMB/CIFS | `core_samba` | `12.10.0` | `started` | `core` |
| [ ] | **Studio Code Server** — Fully featured Visual Studio Code (VSCode) experience integrated in the Home Assistant frontend | `a0d7b954_vscode` | `7.0.0` | `started` | `a0d7b954` |
| [ ] | **Matter Server** — Matter WebSocket Server for Home Assistant Matter support. | `core_matter_server` | `9.2.0` | `started` | `core` |
| [ ] | **Cloudflared** — Use a Cloudflare Tunnel to remotely connect to Home Assistant without opening any ports | `9074a9fa_cloudflared` | `7.0.14` | `started` | `9074a9fa` |
| [ ] | **Home Assistant MCP Server** — AI assistant integration for Home Assistant via Model Context Protocol (MCP) | `81f33d0f_ha_mcp` | `8.4.3` | `started` | `81f33d0f` |
| [ ] | **OpenCode** — AI coding agent for editing Home Assistant configuration with deep MCP integration and LSP support | `f5588468_ha_opencode` | `2.5.4` | `started` | `f5588468` |

## Configured integrations

| Done | Domain | Title | State | Source | Config entry ID | New entities disabled | Polling disabled |
|---|---|---|---|---|---|---|---|
| [ ] | `adaptive_lighting` | Front Door Lighting | `loaded` | `user` | `01KEAQK3GM2JYJ203VFW7M05SQ` | False | False |
| [ ] | `adaptive_lighting` | Garage Light | `loaded` | `user` | `01KEZ89W56GWPGK36ZTREXCGN6` | False | False |
| [ ] | `adaptive_lighting` | Guest Room Lighting | `loaded` | `user` | `01KCCNQ6NV2TBW7ZAWSFSVH3M9` | False | False |
| [ ] | `adaptive_lighting` | Gym Lighting | `loaded` | `user` | `01KCCNR18FGVKW7NB76FCNTFEE` | False | False |
| [ ] | `adaptive_lighting` | Hallway Lighting | `loaded` | `user` | `01KCCNP7BNPWF570PN7KGZTS70` | False | False |
| [ ] | `adaptive_lighting` | Kitchen Lighting | `loaded` | `user` | `01KCCNV37YATAN2HDEXZ7YVM1N` | False | False |
| [ ] | `adaptive_lighting` | Living Room Lighting | `loaded` | `user` | `01KCCNSB7CJNWF7461C5MH4MT3` | False | False |
| [ ] | `adaptive_lighting` | Master Bedroom Lighting | `loaded` | `user` | `01KCCNMKJ64BMY4CV7J1YP1ZZC` | False | False |
| [ ] | `adaptive_lighting` | Office Lighting | `loaded` | `user` | `01KC23Q4KYKA402EQ1K29NWHZY` | False | False |
| [ ] | `aladdin_connect` | Aladdin Connect | `loaded` | `user` | `01K7JKQ22C3N7ADK1BY3TAVPVP` | False | False |
| [ ] | `analytics` | Analytics | `loaded` | `system` | `01KTCFW1ZHG7J2QVXB2FNAWB64` | False | False |
| [ ] | `androidtv` | 192.168.1.202 | `loaded` | `user` | `01KBNRG76GBSK4Z76S5CDQ3RDG` | False | False |
| [ ] | `androidtv` | 192.168.1.224 | `loaded` | `user` | `01KBNJ144J8KHCNK2KKQ2GQ3M0` | False | False |
| [ ] | `androidtv_remote` | Bedroom TV | `not_loaded` | `ignore` | `01KD3KAV64WQ4875QKVJV90RBA` | False | False |
| [ ] | `androidtv_remote` | SHIELD | `loaded` | `zeroconf` | `01KAC0K7PX43ZH65VPN4SGKW0X` | False | False |
| [ ] | `androidtv_remote` | SHIELD | `not_loaded` | `ignore` | `01KFXKWV6P2YK9ZBP73AYMXXQS` | False | False |
| [ ] | `androidtv_remote` | SHIELD Android TV | `loaded` | `user` | `01KG2PJNQ877F4SG01ETBWMRF2` | False | False |
| [ ] | `androidtv_remote` | SmartTV 4K FFM | `loaded` | `zeroconf` | `01KJ933VN4SQM2VQSBGS070GHK` | False | False |
| [ ] | `apple_tv` | Living Room | `loaded` | `zeroconf` | `01K8V5GYRJ6G0AFZ1RZ9YSFT6F` | False | False |
| [ ] | `apple_tv` | Master Bedroom (2) | `loaded` | `zeroconf` | `01K8V5H89PJMXPEQKAXHYHEC2Z` | False | False |
| [ ] | `apple_tv` | Master Bedroom Apple TV | `loaded` | `zeroconf` | `01KBZCG7MMZXTE8KFXX9JFHHC1` | False | False |
| [ ] | `apple_tv` | Music Room | `loaded` | `zeroconf` | `01M19H7FGSERCR7T9MYKAK5JXQ` | False | False |
| [ ] | `apple_tv` | Theater Room | `loaded` | `zeroconf` | `01K8V5JAARX91287QWWG7Y5KQ8` | False | False |
| [ ] | `backup` | Backup | `loaded` | `system` | `01K7J7RR1X754GJ85YT3PV5QD2` | False | False |
| [ ] | `battery_maintenance` | Battery Maintenance | `loaded` | `user` | `01KZSC084EPT78D0XTYHYZS4V1` | False | False |
| [ ] | `bhyve` | stephenefenton@gmail.com | `loaded` | `user` | `01K8V4HTT1A5Q0RCXF7EJVPP8E` | False | False |
| [ ] | `caldav` | stephenefenton@gmail.com | `loaded` | `user` | `01KF6KDM1H4G9PJQMBEK7JS031` | False | False |
| [ ] | `cast` | Google Cast | `loaded` | `zeroconf` | `01K7J7QHWYMDFWTJXZ1HXYQ1R9` | False | False |
| [ ] | `dlna_dmr` | KDL-48W650D | `not_loaded` | `ignore` | `01KHES5PY6QCW54VCQ6H2MT3YH` | False | False |
| [ ] | `dlna_dmr` | SmartTV 4K FFM | `not_loaded` | `ignore` | `01M20QNXMA66ABA57YCCJCC5B1` | False | False |
| [ ] | `donetick` | Donetick | `loaded` | `user` | `01KEMQH7E5EAEH7FW8FVJDM405` | False | False |
| [ ] | `ecobee` | ecobee | `not_loaded` | `ignore` | `01K8V5HYT7RR3D1Q3JB9776KHF` | False | False |
| [ ] | `esphome` | Guest Room Air Purifier | `loaded` | `zeroconf` | `01KCSAAD5Y9KPRQ147JBBKPSEQ` | False | False |
| [ ] | `esphome` | LV600S Humidifier | `loaded` | `user` | `01KZ0AZKFBB9SM31BA07ZHZJ29` | False | False |
| [ ] | `esphome` | Living Room Air Purifier | `loaded` | `zeroconf` | `01KD1AQHYQPAXQ0FK1HA0KN4AQ` | False | False |
| [ ] | `esphome` | Master Bedroom Air Purifier | `loaded` | `zeroconf` | `01KCSYSTZX50E59ZE655T1FFN8` | False | False |
| [ ] | `esphome` | Office Air Purifier | `loaded` | `zeroconf` | `01KCSNF0BE5D9KHGVXW36AZV9Z` | False | False |
| [ ] | `esphome` | Theater Room Air Purifier | `loaded` | `zeroconf` | `01KCSV149PD2ZNQ1NZNF3XPBNS` | False | False |
| [ ] | `esphome` | Transit Tracker 2783a0 | `loaded` | `zeroconf` | `01KJ3AFBD48GQZGC4MK724TPS7` | False | False |
| [ ] | `esphome` | levoit-air-purifier | `loaded` | `zeroconf` | `01KCQWMV10FVC3HDVNJ91TYWQ2` | False | False |
| [ ] | `evershelf` | EverShelf | `loaded` | `user` | `01KW032VQADVHDG1CQZRMPD8T4` | False | False |
| [ ] | `flair` | Flair | `loaded` | `user` | `01K7SHAMRTZTACW8W8XHKFRGQY` | False | False |
| [ ] | `fordpass` | 2021 Mustang Mach-E [VIN: 3FMTK3SU5MMA09266] | `loaded` | `user` | `01K95GFR257209KXSMEHRQRY11` | False | False |
| [ ] | `frigate` | frigate.sfenton-server.com | `loaded` | `user` | `01KBX9ZEXERDR71TGG0ASC5JM3` | False | False |
| [ ] | `go2rtc` | go2rtc | `loaded` | `system` | `01K7J7RB7WYAXH2T0XF8AE7P10` | False | False |
| [ ] | `google_generative_ai_conversation` | Google Generative AI | `loaded` | `user` | `01M1VWP8QVNXQ3KEYKMWSJM4D4` | False | False |
| [ ] | `google_translate` | Google Translate text-to-speech | `loaded` | `onboarding` | `01K7JAY2H8QJ0EW1MVK90HWVAB` | False | False |
| [ ] | `group` | Back Deck Doors | `loaded` | `user` | `01KBNGAWX6JJB80DNKN13N54TN` | False | False |
| [ ] | `group` | Contact Sensors | `loaded` | `user` | `01K86JFY77BNT4V1PSA3DMHJYS` | False | False |
| [ ] | `group` | Door Contact Sensors | `loaded` | `user` | `01KAS6TWTZAD7299E6T6QEQW0V` | False | False |
| [ ] | `group` | Entryway Presence Sensors | `loaded` | `user` | `01KCZNNGFSK49RSDFQBRARP6W8` | False | False |
| [ ] | `group` | Garage Doors | `loaded` | `user` | `01KBNGZNR321KJHGQRGAZP9XWJ` | False | False |
| [ ] | `group` | Guest Bathroom Any Activity | `loaded` | `user` | `01KZY252H2Y3CZQZ4W3RPRNJD9` | False | False |
| [ ] | `group` | Guest Bathroom Occupancy Sensors | `loaded` | `user` | `01KD50TCMFPT51JDX80XQGMC85` | False | False |
| [ ] | `group` | Guest Bathroom Reliable Activity | `loaded` | `user` | `01KZY2583F250DY1FCC0MGG7D9` | False | False |
| [ ] | `group` | Guest Room Occupancy Sensors | `loaded` | `user` | `01KD50W8J2Q62DN40CEC9DNJM8` | False | False |
| [ ] | `group` | Hallway Occupancy Sensors | `loaded` | `user` | `01KBG3KF5MWSE2R22KXRXBWC6A` | False | False |
| [ ] | `group` | Lights | `loaded` | `user` | `01K7NB3ATDTSYCRHDBEPVRTQXX` | False | False |
| [ ] | `group` | Living Room Occupancy Sensors | `loaded` | `user` | `01KCZN7EE3AK7E5BB3Z82BWGE3` | False | False |
| [ ] | `group` | Living Room Vents | `loaded` | `user` | `01K7SNRY3WWWSG2QJPY4E6XGXN` | False | False |
| [ ] | `group` | Master Bedroom Occupancy Sensors | `loaded` | `user` | `01KD50VJ8Y3CC5ETW3BYA0TEZV` | False | False |
| [ ] | `group` | Master Bedroom Vents | `loaded` | `user` | `01K7SNWCFRAH7MNPCEVDNAKT0C` | False | False |
| [ ] | `group` | Music Room Occupancy Sensors | `loaded` | `user` | `01KCZN8VG8R0RT1CV9FS52J6S2` | False | False |
| [ ] | `group` | Occupancy Sensors | `loaded` | `user` | `01KBG3Q41PMYM31WHRV7FVWQZR` | False | False |
| [ ] | `group` | Office Occupancy Sensors | `loaded` | `user` | `01KGK5J42DYNMPREPS1MEBNAY0` | False | False |
| [ ] | `group` | Office Windows | `loaded` | `user` | `01KBGPS9X5547RE391X17QX7CE` | False | False |
| [ ] | `group` | Theater Room Vents | `loaded` | `user` | `01K7SNX1PHVSYPECK2GYPB9ASQ` | False | False |
| [ ] | `group` | Window Contact Sensors | `loaded` | `user` | `01KAS7KBXBNXN6TTWYH4YZT36K` | False | False |
| [ ] | `hacs` | — | `loaded` | `user` | `01K7JHMS7CGHB7GS12C1MQHM59` | False | False |
| [ ] | `harmony` | Harmony Hub 5 | `not_loaded` | `ignore` | `01KDNQYDFMP3S9WHEYBQNPKJWE` | False | False |
| [ ] | `hassio` | Supervisor | `loaded` | `system` | `01K7J7RB6F8QA8HSARBS0DT749` | False | False |
| [ ] | `hdfury` | HDFury (192.168.1.17) | `loaded` | `zeroconf` | `01KGWYKK8ZKN1HBADP6WTTJ58Y` | False | False |
| [ ] | `hisense_tv` | SmartTV 4K FFM | `loaded` | `user` | `01M19HQ1T688PHDX47VMG6G9AK` | False | False |
| [ ] | `home_connect` | Dishwasher App | `loaded` | `user` | `01KDXC79W4Y3FAK8DZAQM9PQAK` | False | False |
| [ ] | `homekit` | Doorbell Bridge:21063 | `loaded` | `import` | `01K8MTP6TAX5TCDNYWQP7JWQ11` | False | False |
| [ ] | `homekit` | HASS Bridge OP:21065 | `loaded` | `user` | `01K8WJF6ZB3FPPK3F64K2A1YN2` | False | False |
| [ ] | `homekit` | HASS Bridge:21064 | `loaded` | `user` | `01K7MSN0BHYANRV08V070DV83D` | False | False |
| [ ] | `homekit_controller` | Aqara-Hub-M3-0056 | `loaded` | `zeroconf` | `01K98R04PN2TGWGZ5K23CHE0HV` | False | False |
| [ ] | `homekit_controller` | B-Hyve CEA5 (Bridge) | `not_loaded` | `ignore` | `01KFXKX6PEQXJYZ9F7XD2A8W6Z` | False | False |
| [ ] | `homekit_controller` | BHyve B8FC (Bridge) | `not_loaded` | `ignore` | `01KAC0HKZ523QB9W134XJRZDTV` | False | False |
| [ ] | `homekit_controller` | Camera-Hub-G5Pro-4FEC | `loaded` | `zeroconf` | `01K8SN9DC5YWQJ8HH1NBTA8WB2` | False | False |
| [ ] | `homekit_controller` | Camera-Hub-G5Pro-C2D7 | `loaded` | `zeroconf` | `01K90BWDDP6E2AEM6JF2J954RV` | False | False |
| [ ] | `homekit_controller` | Doorbell Repeater-D0FC | `loaded` | `user` | `01K8MRVQCTZMGGGVT9Q7QZ67NV` | False | False |
| [ ] | `homekit_controller` | Garage Door 79F3 (Bridge) | `not_loaded` | `ignore` | `01KAC0HNMVWGMCF8F3M2V0C0DM` | False | False |
| [ ] | `homekit_controller` | Homebridge 226D 06B4 (Bridge) | `not_loaded` | `ignore` | `01KAC0HQVSWXNYSZJ2SPRQFCDQ` | False | False |
| [ ] | `homekit_controller` | Homebridge EC8B 8FAB (Bridge) | `not_loaded` | `ignore` | `01KFXKX3NE97S5YHJM4Z496MXP` | False | False |
| [ ] | `homekit_controller` | LG webOS TV 1DEF (Television) | `not_loaded` | `ignore` | `01KAC0M67EVSS94CWWZ5EJ4DAR` | False | False |
| [ ] | `homekit_controller` | Lower-Deck-Cam (Ip Camera) | `not_loaded` | `ignore` | `01KAC0HSMS0E2AGMEK4PDMJVPP` | False | False |
| [ ] | `homekit_controller` | TSVESync 1AF8 (Bridge) | `not_loaded` | `ignore` | `01KAC0M3B4CG1DKZZGEERJ51G4` | False | False |
| [ ] | `homekit_controller` | Theater Remote 9DED (Bridge) | `not_loaded` | `ignore` | `01KAC0J4VZ8XZWT0NCSP5AGDE6` | False | False |
| [ ] | `hue` | Hue Bridge 0017882f3fcd | `loaded` | `zeroconf` | `01K8NS0H0SYQT79KH2KH57V5XS` | False | False |
| [ ] | `huesyncbox` | Sync Box | `loaded` | `zeroconf` | `01M19H851E87C7FGPPHA3JRYVK` | False | False |
| [ ] | `ipp` | HP Color LaserJet M452dw (DA303F) | `loaded` | `zeroconf` | `01M20QP2ST2Q4GA8FD1H5W7829` | False | False |
| [ ] | `local_todo` | Groceries | `loaded` | `user` | `01KF43VB4TFPV3DNJW5JBPJV0W` | False | False |
| [ ] | `local_todo` | Steph Due Today | `loaded` | `user` | `01KE5H9N36C2FW8HV05F0WTQ14` | False | False |
| [ ] | `local_todo` | Steph Past Due | `loaded` | `user` | `01KE5H98S4KR5AP1EXQ35EM9Y7` | False | False |
| [ ] | `local_todo` | Steph Upcoming | `loaded` | `user` | `01KE5H9EBVX939HJDPE1CF1A8G` | False | False |
| [ ] | `local_todo` | Stephen Due Today | `loaded` | `user` | `01KE5FXKCF8ACY8BATZS2H597Y` | False | False |
| [ ] | `local_todo` | Stephen Past Due | `loaded` | `user` | `01KE5FX8GDTR4APWK3G37JX9RR` | False | False |
| [ ] | `local_todo` | Stephen Upcoming | `loaded` | `user` | `01KE5FXS61PKCF1GFJHFRXPKEG` | False | False |
| [ ] | `matter` | Matter | `loaded` | `zeroconf` | `01K7J7SEZEF3TP4ZQRTFTX7737` | False | False |
| [ ] | `met` | Home | `loaded` | `onboarding` | `01K7JAY3B4VM2VRDRT8QYRNCQD` | False | False |
| [ ] | `mobile_app` | Galaxy Z Fold 8 Emulator | `loaded` | `registration` | `01M1ZJ3AXE7GMH57640G6GQ2VD` | False | False |
| [ ] | `mobile_app` | Stephanie’s iPhone | `loaded` | `registration` | `01K7WRFMP7ZNKRSWQPDAXYK0XQ` | False | False |
| [ ] | `mobile_app` | iPad | `loaded` | `registration` | `01KSERVEJCKAS3K5Q4PZ9W8WQ5` | False | False |
| [ ] | `mobile_app` | iPhone 13 Pro (6) | `loaded` | `registration` | `01K7MRNWZ39QSNV4M86SJZ9JAP` | False | False |
| [ ] | `mqtt` | 192.168.1.155 | `loaded` | `user` | `01K8H7CQ89V3P2TNTH0ERT0139` | False | False |
| [ ] | `ollama` | http://192.168.1.155:11434 | `setup_retry` | `user` | `01KKETNMZ7M2DWJYGVJ4YSV1D3` | False | False |
| [ ] | `pirateweather` | Pirate Weather | `loaded` | `user` | `01K8XZ0F1B1YXY6EWZREW38XKE` | False | False |
| [ ] | `presence_based_lighting` | Dining Room | `loaded` | `user` | `01KC31V4H7H2Q7FZDGMY95Q47N` | False | False |
| [ ] | `presence_based_lighting` | Downstairs Hallway | `loaded` | `user` | `01KCZ3DDENKH8NRJNSK1TK20CC` | False | False |
| [ ] | `presence_based_lighting` | Entryway | `loaded` | `user` | `01KCZC5YHYVNP8A81CP81W941S` | False | False |
| [ ] | `presence_based_lighting` | Guest Bathroom | `loaded` | `user` | `01KC3543NRY24Z1YDXMJSJG9Q1` | False | False |
| [ ] | `presence_based_lighting` | Guest Room | `loaded` | `user` | `01KC32E4D6JF15EKF78MCD7XAN` | False | False |
| [ ] | `presence_based_lighting` | Gym | `loaded` | `user` | `01KC35F5Y84K0EZAYK1C3N7D2X` | False | False |
| [ ] | `presence_based_lighting` | Hallway | `loaded` | `user` | `01KC31MBKSCZJDXHTEMYFE0PPT` | False | False |
| [ ] | `presence_based_lighting` | Kitchen | `loaded` | `user` | `01KC35BWKGGYCQM6DSQ8QCZCWJ` | False | False |
| [ ] | `presence_based_lighting` | Living Room | `loaded` | `user` | `01KC350J53BPG7SNHEEW5G0JD6` | False | False |
| [ ] | `presence_based_lighting` | Master Bathroom | `loaded` | `user` | `01KC3575R4NNNY34KVH4XJGX62` | False | False |
| [ ] | `presence_based_lighting` | Master Bathroom (Master Bedroom Lights Off) | `loaded` | `user` | `01KVJ0BZ6Z1HESGZWRKJF2VR18` | False | False |
| [ ] | `presence_based_lighting` | Master Bedroom | `loaded` | `user` | `01KC2R48AW23139X0ZBTDAMF3X` | False | False |
| [ ] | `presence_based_lighting` | Master Bedroom Closet | `loaded` | `user` | `01KEQ5F1HBB5CBWXB5X7Z9SFRX` | False | False |
| [ ] | `presence_based_lighting` | Master Bedroom Closet (Presence Lighting Disabled) | `loaded` | `user` | `01KGECA9AVA90KN6HFJBTFAHV9` | False | False |
| [ ] | `presence_based_lighting` | Music Room | `loaded` | `user` | `01KCYZY3H8Q1JZCGGPQJ49NRNW` | False | False |
| [ ] | `presence_based_lighting` | Office | `loaded` | `user` | `01KC312N9GMN2SE7F48Z6HEW5P` | False | False |
| [ ] | `presence_based_lighting` | Theater Room | `loaded` | `user` | `01KCZ1TZKARVZPC7NKNDHDA654` | False | False |
| [ ] | `presence_based_lighting` | Upper Deck | `loaded` | `user` | `01KDGHSA33RY0F8WCAHNZGBS9K` | False | False |
| [ ] | `radio_browser` | Radio Browser | `loaded` | `onboarding` | `01K7JAY39XDT8S7E01VVQJE19Z` | False | False |
| [ ] | `real_last_changed` | Dining Room Presence Occupancy | `loaded` | `user` | `01KSGFES56DS3PEV71K84ZTZXQ` | False | False |
| [ ] | `real_last_changed` | Dining Room Presence Sensor Occupancy | `loaded` | `user` | `01KTQY3ZHPVD7DFSPP5TNRECC0` | False | False |
| [ ] | `real_last_changed` | Downstairs Hallway Presence Occupancy | `loaded` | `user` | `01KSGFES5K476B7YE13B5X2XAA` | False | False |
| [ ] | `real_last_changed` | Downstairs Hallway Presence Sensor Occupancy | `loaded` | `user` | `01KTSAT67JRJ74434W4H2T62QY` | False | False |
| [ ] | `real_last_changed` | Entryway Presence Occupancy | `loaded` | `user` | `01KSGFES5FHGH15HSW51SD7NQ1` | False | False |
| [ ] | `real_last_changed` | Front Door Presence Sensor Occupancy | `loaded` | `user` | `01KTQY3WH8W88S1VXFNHG0G8TV` | False | False |
| [ ] | `real_last_changed` | Guest Bathroom Entry Presence Sensor Motion | `loaded` | `user` | `01KTQVMBBAPBHPPZ9BJ5E4E97C` | False | False |
| [ ] | `real_last_changed` | Guest Bathroom Presence Sensor Motion | `loaded` | `user` | `01KTQVMB647XK3JSG5DTGD423C` | False | False |
| [ ] | `real_last_changed` | Guest Room Closet Facing Presence Sensor Motion | `loaded` | `user` | `01KTQVMA1GN4QGXG7MYE5X3JMS` | False | False |
| [ ] | `real_last_changed` | Guest Room Presence Sensor Motion | `loaded` | `user` | `01KTQVM9W4B6YXA9283P4ANWHJ` | False | False |
| [ ] | `real_last_changed` | Guest Room Soft Human Presence Occupancy | `loaded` | `user` | `01KSGFES44X58AFWMBJHAA3SAJ` | False | False |
| [ ] | `real_last_changed` | Gym Presence Sensor Motion | `loaded` | `user` | `01KTQVMAWKCGKVTTNZBHEPW4FF` | False | False |
| [ ] | `real_last_changed` | Hallway (Guest/Bath/Gym) Presence Sensor Occupancy | `loaded` | `user` | `01KTQMRY6A14S1NJW1C07V6KNX` | False | False |
| [ ] | `real_last_changed` | Hallway (Office/Bedroom) Presence Sensor Occupancy | `loaded` | `user` | `01KTQMRYEQ27Y2Q5DY4J08X5K9` | False | False |
| [ ] | `real_last_changed` | Hallway/Entryway/Living Room Presence Sensor Occupancy | `loaded` | `user` | `01KTQMRZMJSZE5B4J54Y2A2AM4` | False | False |
| [ ] | `real_last_changed` | Kitchen Presence Occupancy | `loaded` | `user` | `01KSGFES5BPJDCGYVF1BWZA8NH` | False | False |
| [ ] | `real_last_changed` | Kitchen Presence Sensor Motion | `loaded` | `user` | `01KTQVMB1245V52YZBGK84473G` | False | False |
| [ ] | `real_last_changed` | Living Room Bar Presence Sensor Occupancy | `loaded` | `user` | `01KTQY3V5C8KK3GAFAD557BNBW` | False | False |
| [ ] | `real_last_changed` | Living Room Fireplace Presence Sensor Occupancy | `loaded` | `user` | `01KTQY3VKD1XQ6DA49XMREQ549` | False | False |
| [ ] | `real_last_changed` | Living Room Kitchen Wall Presence Sensor Occupancy | `loaded` | `user` | `01KTQY3VXP5JAX3S9Q1F8847Z2` | False | False |
| [ ] | `real_last_changed` | Living Room Presence Occupancy | `loaded` | `user` | `01KSGFES529NXWD92EJWCAA87V` | False | False |
| [ ] | `real_last_changed` | Living Room Presence Sensor Occupancy | `loaded` | `user` | `01KTQY3R18QFYVZY39VC1M8MAK` | False | False |
| [ ] | `real_last_changed` | Master Bathroom Presence Sensor Occupancy | `loaded` | `user` | `01KTQTPK1E4GSZES3T326BVQH1` | False | False |
| [ ] | `real_last_changed` | Master Bedroom Bathroom Presence Sensor Occupancy | `loaded` | `user` | `01KTQTPGE1AR8E762TXGSFB5W0` | False | False |
| [ ] | `real_last_changed` | Master Bedroom Bed Presence Sensor | `loaded` | `import` | `01M1ABPYG556YCFYVQSYKD6B7P` | False | False |
| [ ] | `real_last_changed` | Master Bedroom Closet Presence Sensor Occupancy | `loaded` | `user` | `01KTQTPH929V54MXQ2Z8DM1WR7` | False | False |
| [ ] | `real_last_changed` | Master Bedroom Window Presence Sensor Occupancy | `loaded` | `user` | `01KTQTPG58DNGYHMKA1RY5J8MT` | False | False |
| [ ] | `real_last_changed` | Music Room Door Presence Sensor Occupancy | `loaded` | `user` | `01KTSZAMEC4F2JRS4ER3MDR2F7` | False | False |
| [ ] | `real_last_changed` | Music Room Kitchenette Presence Sensor Occupancy | `loaded` | `user` | `01KTSZAMQ0C70HJGN6ACG5QZT5` | False | False |
| [ ] | `real_last_changed` | Music Room North Wall Presence Sensor Occupancy | `loaded` | `user` | `01KTSZAN00EKAWX05VXXH48FSM` | False | False |
| [ ] | `real_last_changed` | Music Room Presence Occupancy | `loaded` | `user` | `01KSGFES6BQF95AEA9NQVP5CND` | False | False |
| [ ] | `real_last_changed` | Office Closet Presence Sensor Temperature | `loaded` | `user` | `01KTQJXFYF0A22P8ZZ2N46485D` | False | False |
| [ ] | `real_last_changed` | Office Presence Sensor Temperature | `loaded` | `user` | `01KTQJXFVXY38E7SP7MZY2GJ7R` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.dining_room_door_contact_sensor_contact | `loaded` | `user` | `01KBRCHMBMF37DYQJ6685211QZ` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.front_door_contact_sensor_contact | `loaded` | `user` | `01KBRCJEDDFG2XAYZKPSEF2WY5` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.garage_door_contact_sensor_contact | `loaded` | `user` | `01KBTPNGRMPBDX3S5QS6SNQ1QT` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.guest_room_window_contact_sensor_contact | `loaded` | `user` | `01KBRCMEDJBW8AD41MYSE6KVZM` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.gym_window_contact_sensor_contact | `loaded` | `user` | `01KBRCM2F8DHGTWXKW2JTRNG2R` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.kitchen_door_contact_sensor_contact | `loaded` | `user` | `01KBRCHZYPXQ6ZZFMVQ4V6TYHE` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.living_room_window_contact_sensor_contact | `loaded` | `user` | `01KBRCH7G454VH5RKB5ZWDTWH1` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.master_bedroom_street_window_contact_sensor_contact | `loaded` | `user` | `01KBRCNXVH7JZVYD1Q8E7C8Y0K` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.music_room_door_contact_sensor_contact | `loaded` | `user` | `01KBRCK0NNB5QEPPC97BNSPF5V` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.office_pc_window_sensor_contact | `loaded` | `user` | `01KBRCNE2TM7T7NVCVKRWS3EES` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.office_window_contact_sensor_contact | `loaded` | `user` | `01KBRCMTN126B5CE0PKJ8HKVCH` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: binary_sensor.theater_room_door_contact_sensor_contact | `loaded` | `user` | `01KBRCKM8M6ZZ32XEA9M9Z7QP1` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.dining_room_vent_vent | `loaded` | `user` | `01KC31WH1XP1F40ZBPFJVDE55Y` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.guest_bathroom_vent_vent | `loaded` | `user` | `01KC352RSC0JW5YCY64KDJVE3F` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.guest_room_vent_vent | `loaded` | `user` | `01KC32CQT96DXQ66WPY2PT2EDS` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.gym_vent_vent | `loaded` | `user` | `01KC35DWYMN65VBXTN15P8Q28H` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.kitchen_vent_vent | `loaded` | `user` | `01KC35AD464JN6714KCCCSCDDG` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.living_room_vents | `loaded` | `user` | `01KC34Z0WJ3A4J39YG1QXHCRGC` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.master_bathroom_vent_vent | `loaded` | `user` | `01KC355M1V9VV5118XKB7SMQND` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.master_bedroom_vents | `loaded` | `user` | `01KC2RBB8N0KF2ZBA103G6GHKC` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: cover.office_vent_vent | `loaded` | `user` | `01KC315FRDP6S9N1AQ0MGJ8TQ5` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.dining_room_dimmer_switch_action | `loaded` | `user` | `01KBRBRKQHD3917MR4JS9GQ8QE` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.dining_room_door_light_switch_action | `loaded` | `user` | `01KBTKD8GEJ7RKWA0RHKB74SNH` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.downstairs_hallway_light_switch_action | `loaded` | `user` | `01KBRBTN09JKJE21700T5XSXHF` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.front_door_downstairs_hallway_light_switch_action | `loaded` | `user` | `01KBRBV9HS4RWFN9H7G1PE6MSN` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.front_door_entryway_light_switch_action | `loaded` | `user` | `01KBRBT1KH9GHFM9K48JN7TQ2Z` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.front_door_exterior_light_switch_action | `loaded` | `user` | `01KEAQ5TN56694D4AWCEBZCQFV` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.guest_bathroom_dimmer_switch_action | `loaded` | `user` | `01KBRBNHS3QK5HARTSK0VP0WQ0` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.guest_bathroom_fan_switch_action | `loaded` | `user` | `01KBRBP01R9GREEXFDKNZS17F3` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.guest_bathroom_towel_rack_switch_action | `loaded` | `user` | `01KBRBPCJ2J5A2FCN46AMZV46J` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.guest_bedroom_light_switch_action | `loaded` | `user` | `01KBRBJ4VG5VAWFXRZYWQSX4A8` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.gym_light_switch_action | `loaded` | `user` | `01KBNZN1SYAP4PDDF26MJYM4Z9` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.hallway_light_switch_action | `loaded` | `user` | `01KBRBPTMK468CDW10NKPR3W71` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.kitchen_door_light_switch_action | `loaded` | `user` | `01KBRBR88NTC67W1HE1YXHQ199` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.kitchen_entry_light_switch_action | `loaded` | `user` | `01KBRBQ6QS0T4SZ7K04PJ5B1JZ` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.kitchen_stove_light_switch_action | `loaded` | `user` | `01KBRBQX31NY0Z4XNP6QHBPJK6` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.living_room_light_switch_action | `loaded` | `user` | `01KBRBS4VMQW099PAMQ2F4S9TQ` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.master_bathroom_dimmer_switch_action | `loaded` | `user` | `01KBRBN0S4Z69G0Y2MMG2D8P0F` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.master_bathroom_fan_switch_action | `loaded` | `user` | `01KBRBKXW5C4R56Y57YAHA5R1K` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.master_bathroom_towel_rack_switch_action | `loaded` | `user` | `01KBRBMCSMYRP92BCZ55E6T6KF` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.master_bedroom_light_switch_action | `loaded` | `user` | `01KBRBK2ZCXERGNF06KCS5YFC0` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.music_room_fireplace_light_switch_action | `loaded` | `user` | `01KBRBVQCPP8GREHXVXWQH7AJ2` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.music_room_server_light_switch_action | `loaded` | `user` | `01KBRBW5WEY97ZGRZJPDC2XVR6` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.office_light_switch_action | `loaded` | `user` | `01KBRBJJPYT0MERYN0BSPQHXFC` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.theater_room_light_switch_action | `loaded` | `user` | `01KBRBWJJN9PSY6E02D545DC95` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: event.upper_entryway_light_switch_action | `loaded` | `user` | `01KBRBSHVGEX0AJBZ3HHGSBX3T` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: input_boolean.is_front_door_auto_lock_enabled | `loaded` | `user` | `01KC7C4DTEVNNZ70ZE58RB8V2P` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: input_select.yamaha_avr_inputs | `loaded` | `user` | `01KGJ41N2K6TWK9VWV5FYN1Y10` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.back_deck | `loaded` | `user` | `01KDGHQS118EKPT57CA19JKPQB` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.dining_room_dimmer_switch | `loaded` | `user` | `01KC071FH5EBZHE52J1VPCCPZS` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.downstairs_hallway_light | `loaded` | `user` | `01KCZ3E2BJ9ZFNEDVVS1XMA5DV` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.garage_camera_floodlight | `loaded` | `user` | `01KDP3J4VV6FD55Y7E76GGY7KA` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.guest_bathroom_dimmer_switch | `loaded` | `user` | `01KC1X29Z8SPTJ21EE0CQ8DMSR` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.guest_bathroom_dimmer_switch | `loaded` | `user` | `01KCQ7W259BRP4QAF67JEVR4D9` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.guest_room | `loaded` | `user` | `01KC1YAGGMS6ZADQF5GWZS9G1E` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.guest_room | `loaded` | `user` | `01KC32C32TAQXF510F52C64T7Y` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.gym_light | `loaded` | `user` | `01KC1WXY1MS5SBV1A6G0Y7TKKC` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.hallway | `loaded` | `user` | `01KC22HJKATYQY1CJYTB6XANGW` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.hallway_lights | `loaded` | `user` | `01KC31KVWSY2AA39EQ5AT8QRV6` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.kitchen | `loaded` | `user` | `01KC1WKHRWSEDYP2VCS4QNCY2W` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.kitchen | `loaded` | `user` | `01KC359ZS4T56VJP0P2A8A6DZH` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.living_room | `loaded` | `user` | `01KC1WRCRR2W1WT3YCZYFBCC6V` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.living_room | `loaded` | `user` | `01KC343FNZ0HHWPFWKVTF7AM98` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.master_bathroom_dimmer_switch | `loaded` | `user` | `01KC22Q373PTEETPJ416163HX4` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.master_bedroom | `loaded` | `user` | `01KC08K271EWSYKRVA5K3ZGMPS` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.master_bedroom_closet_light | `loaded` | `user` | `01KEQ5CHZK91HAX02Z39AVFVXH` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.music_room | `loaded` | `user` | `01KCYZYZ8Q2YGG89A7XRFB3SWX` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.office_light | `loaded` | `user` | `01KC1YF65HHNGJQFHD966H7MWN` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: light.theater_room | `loaded` | `user` | `01KCZ1S20MFJ11N3MJRBE4K2HG` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: lock.aqara_smart_lock_u100 | `loaded` | `user` | `01KBTPVVWZ8XQJKXEHV63NYKTN` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: select.roborock_s7_maxv_selected_map | `loaded` | `user` | `01KC7FBNRYAT4F0ZFNM4E9K4HA` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: sensor.air_purifier_air_quality_index | `loaded` | `user` | `01KCSB6VGCM4KPF5ZJBPS1XFWX` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: sensor.air_purifier_pm2_5 | `loaded` | `user` | `01KCSB7DE1T0HGTTF1CPN63GMT` | False | False |
| [ ] | `real_last_changed` | Real Last Changed: switch.upper_entryway_light_switch_top | `loaded` | `user` | `01KCZC1ZZW41KKRQ5AZ8NE97P5` | False | False |
| [ ] | `real_last_changed` | Theater Room Presence Occupancy | `loaded` | `user` | `01KSGFES6GASEYVWG0W1SPCEWE` | False | False |
| [ ] | `real_last_changed` | Theater Room Presence Sensor Occupancy | `loaded` | `user` | `01KTSAT6H6KPFBR879Z0M3JKRJ` | False | False |
| [ ] | `real_last_changed` | Thermostat Hub W200 Occupancy | `loaded` | `user` | `01KSG1M8M61S2PRXPJ5MM3584K` | False | False |
| [ ] | `reolink` | Garage | `loaded` | `user` | `01KDP0XYK4808D23JTHXVSSBBR` | False | False |
| [ ] | `roborock` | Roborock | `not_loaded` | `ignore` | `01K7MEFHMFGZDXX0M112FRYTNG` | False | False |
| [ ] | `shopping_list` | Groceries | `loaded` | `onboarding` | `01K7JAY2FHKSYK843PW23JK9Q8` | False | False |
| [ ] | `sonos` | Sonos | `loaded` | `zeroconf` | `01K7J7QV7KZ0HJS601NQR7RPC6` | False | False |
| [ ] | `sony_projector_adcp` | Sony Projector | `loaded` | `user` | `01KYWC0D33XGFFCK9RCZHVRCR6` | False | False |
| [ ] | `statistics` | Guest Bathroom Shower Humidity Minimum 4h | `loaded` | `user` | `01M1QJS855A1KQ7H50ZRNKR9BR` | False | False |
| [ ] | `statistics` | Master Bathroom Shower Humidity Minimum 4h | `loaded` | `user` | `01M1QJRR5MW0R96ZT7JDXBTXM1` | False | False |
| [ ] | `sun` | Sun | `loaded` | `import` | `01K7J7PX6FEEV7NGQ5MVB8DDKT` | False | False |
| [ ] | `synology_dsm` | Rackstation-1 | `loaded` | `ssdp` | `01KESGQ9VCN3C8A1360G3ZG8ZM` | False | False |
| [ ] | `synology_dsm` | Rackstation-2 | `loaded` | `ssdp` | `01KESGFV8MPH9Y8MGAKEBNEMPC` | False | False |
| [ ] | `systemmonitor` | System Monitor | `loaded` | `user` | `01K95K9T5PS574NM4RFC92TXYH` | False | False |
| [ ] | `template` | Guest Bathroom Allowed Horizontal Motion | `loaded` | `user` | `01KZY25CDTRQ3WEFXZA4EJJASE` | False | False |
| [ ] | `template` | Guest Bathroom Confirmed Horizontal Occupancy | `loaded` | `user` | `01M0KQ99YW8118576TXFRRM2A8` | False | False |
| [ ] | `template` | Guest Bathroom Shower Shadow Active | `loaded` | `user` | `01M1QJVJPWF0MYP5AD9YZCYQ0P` | False | False |
| [ ] | `template` | Household Journey Steph Home | `loaded` | `user` | `01M08DD7ASXHKKE206A06HM0C6` | False | False |
| [ ] | `template` | Household Journey Stephen Home | `loaded` | `user` | `01M08DD31X0PVQCB4TJ0535G83` | False | False |
| [ ] | `template` | Human Presence Dining Room | `loaded` | `user` | `01KSZXZY60ZCQ16C434X72B1CJ` | False | False |
| [ ] | `template` | Human Presence Entryway | `loaded` | `user` | `01KSZXZY5JPS5K3WPGMK1CEN2J` | False | False |
| [ ] | `template` | Human Presence Guest Bathroom | `loaded` | `user` | `01KSZXZY6P6G745VZM0CKN35J0` | False | False |
| [ ] | `template` | Human Presence Guest Room | `loaded` | `user` | `01KSZXZY4M30ZCNTPWW72M43PW` | False | False |
| [ ] | `template` | Human Presence Gym | `loaded` | `user` | `01KSZXZY73ZC8MGVDS2V1QMYG2` | False | False |
| [ ] | `template` | Human Presence Kitchen | `loaded` | `user` | `01KSZXZY47GKMZHQHWG1XN9CK2` | False | False |
| [ ] | `template` | Human Presence Master Bathroom | `loaded` | `user` | `01KSZXYNZYC06VANB618T0MJM9` | False | False |
| [ ] | `template` | Human Presence Master Bedroom Bathroom | `loaded` | `user` | `01KSZXZY6EHBNEBTHBM975JEWY` | False | False |
| [ ] | `template` | Human Presence Master Bedroom Bed | `loaded` | `user` | `01M1ACJ34KGKSVRPKPKC125H1A` | False | False |
| [ ] | `template` | Human Presence Master Bedroom Closet | `loaded` | `user` | `01KSZXZY7RSZVGHQKJKBWR3QQ0` | False | False |
| [ ] | `template` | Human Presence Master Bedroom Window | `loaded` | `user` | `01KSZXZY3R2VH92X8Q9BJK1RZF` | False | False |
| [ ] | `template` | Human Presence Office | `loaded` | `user` | `01KSZXZY7F72E5FGMAAAXF01FN` | False | False |
| [ ] | `template` | Master Bathroom Shower Shadow Active | `loaded` | `user` | `01M1QJV4H77Q6H14C8EQZ97Z46` | False | False |
| [ ] | `template` | Master Bedroom PBL Main Floor Vacuum Clear | `loaded` | `user` | `01M1ACJJ7CK568NPQ97HRXKFMX` | False | False |
| [ ] | `template` | Master Bedroom PBL Overnight Recovery Eligible | `loaded` | `user` | `01M1A27N9QY9SA8Y5AQTW1ZJJ0` | False | False |
| [ ] | `template` | Master Suite Cross Room Prelighting Allowed | `loaded` | `user` | `01M0AVMWMHG0A80EA3QTP28HPR` | False | False |
| [ ] | `template` | Master Suite Local Only Lighting | `loaded` | `user` | `01M0AVN0WYRHN00ENH52GTVMX4` | False | False |
| [ ] | `template` | Music Room Active Media Source | `loaded` | `user` | `01M1JZ4TB7KNT0SEDGWSA75HM4` | False | False |
| [ ] | `template` | Predictive Cooling Dishwasher Heat Load | `loaded` | `user` | `01KXBRKV64KWCP77B5GRFDCNNZ` | False | False |
| [ ] | `template` | Predictive Cooling Living Room Heat Load | `loaded` | `user` | `01KXBRKK37DXHRH9T685WXZ37A` | False | False |
| [ ] | `template` | Predictive Cooling Music Room Heat Load | `loaded` | `user` | `01KXBRKQ7YT0V271KM1MTDQ8ZE` | False | False |
| [ ] | `template` | Predictive Cooling Office Heat Load | `loaded` | `user` | `01KXBRK8N8N2V1JAKP9Z4JQTYC` | False | False |
| [ ] | `template` | Predictive Cooling SleepyPod Heat Load | `loaded` | `user` | `01KXBRM2NTTQ6V75E7AHBME1RR` | False | False |
| [ ] | `template` | Predictive Cooling Theater Heat Load | `loaded` | `user` | `01KXBRKEWZFR1THZJY8BAQE0JD` | False | False |
| [ ] | `template` | SleepyPod Steph Schedule Phase | `loaded` | `user` | `01KXCC758P3ZZ01S0CK8V55V5C` | False | False |
| [ ] | `template` | SleepyPod Stephen Schedule Phase | `loaded` | `user` | `01KXCC6WCP6ESKBJQQ2904JPNX` | False | False |
| [ ] | `template` | Thermostat Effective Home Away | `loaded` | `user` | `01KXCM3BCH4MW9HNVEKC2S0FDT` | False | False |
| [ ] | `template` | Thermostat Home Away Reason | `loaded` | `user` | `01KXCM47SGEJHYFY068C7WF4K4` | False | False |
| [ ] | `thermostat_contact_sensors` | Thermostat Contact Sensors | `loaded` | `user` | `01KCTHNAEGGQJST735JQEH6EDV` | False | False |
| [ ] | `thread` | Thread | `loaded` | `zeroconf` | `01K7J7R047TR6P2KT22GXYZ07Q` | False | False |
| [ ] | `tplink` | EF2E KP125M (192.168.1.19) | `not_loaded` | `ignore` | `01KFCJ9ZDDY7YAHG0BPZ5AT9QP` | False | False |
| [ ] | `tplink` | F5E0 KP125M (192.168.1.122) | `not_loaded` | `ignore` | `01KFCJA0XD9N1N1M9Q0P7M86F2` | False | False |
| [ ] | `traeger` | stephenefenton@gmail.com | `loaded` | `user` | `01KDBJS5HGB66QC31C85AV85NY` | False | False |
| [ ] | `transit_tracker` | Transit Tracker 2783a0 | `loaded` | `user` | `01KJ3XQCK5B6BJ0PQ2P2SF14DY` | False | False |
| [ ] | `upnp` | GS308EP-693860 | `not_loaded` | `ignore` | `01K8V5J4F8ZMXH2Y901TTJ27J4` | False | False |
| [ ] | `valetudo` | Augmentations | `loaded` | `user` | `01KFH35R548Y24AM9RZ6CZEPAC` | False | False |
| [ ] | `valetudo` | Valetudo Icons | `loaded` | `user` | `01KFH2MJJVKB3VZ3Q1Q05M0YEM` | False | False |
| [ ] | `vesync` | stephenefenton@gmail.com | `loaded` | `user` | `01K7NEW5DANQF14KVE82ZTZ1XF` | False | False |
| [ ] | `wake_light` | Master Bedroom | `loaded` | `user` | `01M1JVGW9GTVBNMB6FP6WARQHX` | False | False |
| [ ] | `wake_on_lan` | Wake on LAN 04:7c:16:8a:9b:1f | `loaded` | `user` | `01KDRN25D1D0WMRGPJ5FMA2B8Y` | False | False |
| [ ] | `wake_on_lan` | Wake on LAN 50:eb:f6:81:5e:70 | `loaded` | `user` | `01KHMRDS4CE02J2GBQCP05P2DD` | False | False |
| [ ] | `wake_on_lan` | Wake on LAN 60:cf:84:80:90:db | `loaded` | `user` | `01KDPNPST9JR4745S1MWM442BT` | False | False |
| [ ] | `wake_on_lan` | Wake on LAN 74:56:3c:cb:5a:c2 | `loaded` | `user` | `01KSE4QGFKN292E0Y5X0BMWJ1C` | False | False |
| [ ] | `wake_on_lan` | Wake on LAN 94:6a:b0:cf:e7:54 | `loaded` | `user` | `01KF4T2WMFXZVSC1637DMZVHBH` | False | False |
| [ ] | `webostv` | LG webOS TV OLED65C9PUA | `loaded` | `user` | `01KAC0SN8TJKTX2MV6CENTCV0M` | False | False |
| [ ] | `webrtc` | WebRTC Camera | `loaded` | `user` | `01KKCXZBD2GRRC4ET8ZZTV0D88` | False | False |
| [ ] | `xbox` | SFenton3676 | `loaded` | `user` | `01M18EMDWJG1RP70XGVWB1EFDD` | False | False |
| [ ] | `xbox` | Xbox | `not_loaded` | `ignore` | `01KAC0QZDWC4Q4N0P43NC2P940` | False | False |
| [ ] | `yamaha_musiccast` | 192.168.1.83 | `loaded` | `user` | `01KBNSHTY9VET16K6KF0WK1W7M` | False | False |
| [ ] | `zha` | Sonoff Zigbee 3.0 USB Dongle Plus | `not_loaded` | `ignore` | `01KDNQYJX8ES7YPYXVK4ZFH3XZ` | False | False |

## Devices

Each row below is one Home Assistant device-registry entry. Entities are listed beneath their owning device.

### `adaptive_lighting` (9 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Front Door Lighting** | — | `front_yard` | `85688076e27c1a8c1c9187c0b77515f4` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_front_door_lighting` — Adaptive Lighting Adapt Brightness: Front Door Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_front_door_lighting` — Adaptive Lighting Adapt Color: Front Door Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_front_door_lighting` — Adaptive Lighting: Front Door Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_front_door_lighting` — Adaptive Lighting Sleep Mode: Front Door Lighting (`adaptive_lighting`) | | | | | |
| [ ] | **Garage Light** | — | `front_yard` | `abb2297fca91f615fc65ed82df850b3a` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_garage_light` — Adaptive Lighting Adapt Brightness: Garage Light (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_garage_light` — Adaptive Lighting Adapt Color: Garage Light (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_garage_light` — Adaptive Lighting: Garage Light (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_garage_light` — Adaptive Lighting Sleep Mode: Garage Light (`adaptive_lighting`) | | | | | |
| [ ] | **Guest Room Lighting** | — | `guest_room` | `dfe1f13eab28ca459f30bd49a7307fd3` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_guest_room_lighting` — Adaptive Lighting Adapt Brightness: Guest Room Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_guest_room_lighting` — Adaptive Lighting Adapt Color: Guest Room Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_guest_room_lighting` — Adaptive Lighting: Guest Room Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_guest_room_lighting` — Adaptive Lighting Sleep Mode: Guest Room Lighting (`adaptive_lighting`) | | | | | |
| [ ] | **Gym Lighting** | — | `gym` | `63f185df31d3ecb48a30b9e739deac7e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_gym_lighting` — Adaptive Lighting Adapt Brightness: Gym Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_gym_lighting` — Adaptive Lighting Adapt Color: Gym Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_gym_lighting` — Adaptive Lighting: Gym Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_gym_lighting` — Adaptive Lighting Sleep Mode: Gym Lighting (`adaptive_lighting`) | | | | | |
| [ ] | **Hallway Lighting** | — | `hallway` | `46b47f3371fdefe6bb22d99db1889b2c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_hallway_lighting` — Adaptive Lighting Adapt Brightness: Hallway Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_hallway_lighting` — Adaptive Lighting Adapt Color: Hallway Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_hallway_lighting` — Adaptive Lighting: Hallway Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_hallway_lighting` — Adaptive Lighting Sleep Mode: Hallway Lighting (`adaptive_lighting`) | | | | | |
| [ ] | **Kitchen Lighting** | — | `kitchen` | `1f6f43b33df46bdf508c51919ca68998` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_kitchen_lighting` — Adaptive Lighting Adapt Brightness: Kitchen Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_kitchen_lighting` — Adaptive Lighting Adapt Color: Kitchen Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_kitchen_lighting` — Adaptive Lighting: Kitchen Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_kitchen_lighting` — Adaptive Lighting Sleep Mode: Kitchen Lighting (`adaptive_lighting`) | | | | | |
| [ ] | **Living Room Lighting** | — | `living_room` | `2eec9fdf4b9f820f7d1a1d91daef6ecb` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_living_room_lighting` — Adaptive Lighting Adapt Brightness: Living Room Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_living_room_lighting` — Adaptive Lighting Adapt Color: Living Room Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_living_room_lighting` — Adaptive Lighting: Living Room Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_living_room_lighting` — Adaptive Lighting Sleep Mode: Living Room Lighting (`adaptive_lighting`) | | | | | |
| [ ] | **Master Bedroom Lighting** | — | `master_bedroom` | `181f83745017c1c88b20475cd472bb60` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_master_bedroom_lighting` — Adaptive Lighting Adapt Brightness: Master Bedroom Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_master_bedroom_lighting` — Adaptive Lighting Adapt Color: Master Bedroom Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_master_bedroom_lighting` — Adaptive Lighting: Master Bedroom Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_master_bedroom_lighting` — Adaptive Lighting Sleep Mode: Master Bedroom Lighting (`adaptive_lighting`) | | | | | |
| [ ] | **Office Lighting** | — | `office` | `7f4589fb553a55e81966dde3e5a90e6d` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_brightness_home_lighting` — Adaptive Lighting Adapt Brightness: Home Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_adapt_color_home_lighting` — Adaptive Lighting Adapt Color: Home Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_home_lighting` — Adaptive Lighting: Home Lighting (`adaptive_lighting`) | | | | | |
|  | ↳ `switch.adaptive_lighting_sleep_mode_home_lighting` — Adaptive Lighting Sleep Mode: Home Lighting (`adaptive_lighting`) | | | | | |

### `aladdin_connect` (2 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Left Door** | Aladdin Connect | `garage` | `365230386a3b1707a57486c31f8fb312` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `cover.garage_left_door` — — (`aladdin_connect`) | | | | | |
|  | ↳ `sensor.garage_left_door_battery` — Battery (`aladdin_connect`) | | | | | |
| [ ] | **Right Door** | Aladdin Connect | `garage` | `9a21ca85d1ca86f94c88882bb914c906` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `cover.garage_right_door` — — (`aladdin_connect`) | | | | | |
|  | ↳ `sensor.garage_right_door_battery` — Battery (`aladdin_connect`) | | | | | |

### `androidtv` (2 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Living Room SHIELD** | NVIDIA / SHIELD Android TV (Android TV) / 11 | `living_room` | `ae55cdb74cf06aa40cfcd68b3dcb0f8e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.living_room_shield_2` — — (`androidtv`) | | | | | |
|  | ↳ `remote.living_room_shield_2` — — (`androidtv`) | | | | | |
| [ ] | **Theater Room SHIELD** | NVIDIA / SHIELD Android TV (Android TV) / 11 | `theater_room` | `8c2e2f173a2b5038803e762b47362280` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.theater_room_shield` — — (`androidtv`) | | | | | |
|  | ↳ `remote.theater_room_shield` — — (`androidtv`) | | | | | |

### `androidtv_remote` (3 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Living Room SHIELD** | NVIDIA / SHIELD Android TV | `living_room` | `cd3468ae9df9f5f34d168c5996e448ff` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.living_room_shield` — — (`androidtv_remote`) | | | | | |
|  | ↳ `remote.living_room_shield` — — (`androidtv_remote`) | | | | | |
| [ ] | **Music Room TV (Android)** | Hisense / SmartTV 4K FFM | `music_room` | `9a5b74b9053de24d0385ee100ad45cf1` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.music_room_tv_android` — — (`androidtv_remote`) | | | | | |
|  | ↳ `remote.music_room_tv_android` — — (`androidtv_remote`) | | | | | |
| [ ] | **Theater Shield Remote** | NVIDIA / SHIELD Android TV | `theater_room` | `bc9753ede6fb4c7c56d1f610ab5fed33` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.theater_shield_remote` — — (`androidtv_remote`) | | | | | |
|  | ↳ `remote.theater_shield_remote` — — (`androidtv_remote`) | | | | | |

### `apple_tv` (5 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Living Room** | Apple / HomePod Mini / 26.6 | `living_room` | `343ae06ff5fbc6beeaab900f5742fa3c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.living_room` — — (`apple_tv`) | | | | | |
|  | ↳ `remote.living_room` — — (`apple_tv`) | | | | | |
| [ ] | **HomePod Mini** | Apple / HomePod Mini / 26.2 | `master_bedroom` | `0ef3d4385e601dfecf979ff5b3c73182` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.homepod_mini` — — (`apple_tv`) | | | | | |
|  | ↳ `remote.homepod_mini` — — (`apple_tv`) | | | | | |
| [ ] | **Master Bedroom Apple TV** | Apple / Apple TV 4K (gen 3) / 26.6 | `master_bedroom` | `17afd76cea73e9ca136d246e63507521` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_apple_tv_keyboard_focus` — Keyboard focus (`apple_tv`) | | | | | |
|  | ↳ `media_player.master_bedroom_apple_tv` — — (`apple_tv`) | | | | | |
|  | ↳ `remote.master_bedroom_apple_tv` — — (`apple_tv`) | | | | | |
| [ ] | **Music Room** | Apple / HomePod Mini / 26.6 | `music_room` | `0c5bb492a687a01b1e66b636502cb17c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.music_room_music_room` — — (`apple_tv`) | | | | | |
|  | ↳ `remote.music_room_music_room` — — (`apple_tv`) | | | | | |
| [ ] | **HomePod Mini** | Apple / HomePod Mini / 26.6 | `theater_room` | `8e307007a4a37e57340d995420546602` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.homepod_mini_2` — — (`apple_tv`) | | | | | |
|  | ↳ `remote.homepod_mini_2` — — (`apple_tv`) | | | | | |

### `backup` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Backup** | Home Assistant / Home Assistant Backup / 2026.9.1 | `—` | `98e28397292c1dd86b958230953d373a` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `event.backup_automatic_backup` — Automatic backup (`backup`) | | | | | |
|  | ↳ `sensor.backup_backup_manager_state` — Backup Manager state (`backup`) | | | | | |
|  | ↳ `sensor.backup_last_attempted_automatic_backup` — Last attempted automatic backup (`backup`) | | | | | |
|  | ↳ `sensor.backup_last_successful_automatic_backup` — Last successful automatic backup (`backup`) | | | | | |
|  | ↳ `sensor.backup_next_scheduled_automatic_backup` — Next scheduled automatic backup (`backup`) | | | | | |

### `bhyve` (4 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Backyard Faucet** | Orbit BHyve / HT34A-0001 / 141 | `back_deck` | `44d8ad0f0f46b576cce1f13aec9bbacc` | `f4da009b1070f2c224a33e68c63411e2` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.backyard_faucet_fault` — Fault (`bhyve`) | | | | | |
|  | ↳ `select.backyard_faucet_device_mode` — Device mode (`bhyve`) | | | | | |
|  | ↳ `sensor.backyard_faucet_battery_level` — Battery level (`bhyve`) | | | | | |
|  | ↳ `sensor.backyard_faucet_next_watering` — Next watering (`bhyve`) | | | | | |
|  | ↳ `sensor.backyard_faucet_state` — State (`bhyve`) | | | | | |
|  | ↳ `sensor.backyard_zone_history` — Backyard zone history (`bhyve`) | | | | | |
|  | ↳ `sensor.bushes_zone_history` — Sidewalk (New) zone history (`bhyve`) | | | | | |
|  | ↳ `sensor.house_zone_history` — Bushes (New) zone history (`bhyve`) | | | | | |
|  | ↳ `sensor.sidewalk_zone_history` — House zone history (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_backyard_program` — Backyard program (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_backyard_smart_watering` — Backyard smart watering (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_bushes_program` — Bushes program (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_bushes_smart_watering` — Sidewalk (New) smart watering (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_house_program` — House program (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_house_smart_watering` — Bushes (New) smart watering (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_rain_delay` — Rain delay (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_sidewalk_program` — Sidewalk program (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_faucet_sidewalk_smart_watering` — House smart watering (`bhyve`) | | | | | |
|  | ↳ `switch.backyard_zone` — Backyard zone (`bhyve`) | | | | | |
|  | ↳ `switch.bushes_zone` — Bushes zone (`bhyve`) | | | | | |
|  | ↳ `switch.house_zone` — House zone (`bhyve`) | | | | | |
|  | ↳ `switch.sidewalk_zone` — Sidewalk zone (`bhyve`) | | | | | |
|  | ↳ `valve.backyard_faucet_backyard_zone` — Backyard zone (`bhyve`) | | | | | |
|  | ↳ `valve.backyard_faucet_bushes_zone` — Sidewalk (New) zone (`bhyve`) | | | | | |
|  | ↳ `valve.backyard_faucet_house_zone` — Bushes (New) zone (`bhyve`) | | | | | |
|  | ↳ `valve.backyard_faucet_sidewalk_zone` — House zone (`bhyve`) | | | | | |
| [ ] | **Front Yard Faucet** | Orbit BHyve / HT25-0000 / 0085 | `entryway` | `bdf791f9d2d8d88b5da0ebb155096e69` | `f89e80367028f3e390b6590597e7cadd` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.front_yard_fault` — Fault (`bhyve`) | | | | | |
|  | ↳ `select.front_yard_device_mode` — Device mode (`bhyve`) | | | | | |
|  | ↳ `sensor.front_yard_battery_level` — Battery level (`bhyve`) | | | | | |
|  | ↳ `sensor.front_yard_next_watering` — Next watering (`bhyve`) | | | | | |
|  | ↳ `sensor.front_yard_state` — State (`bhyve`) | | | | | |
|  | ↳ `sensor.front_yard_zone_history` — Zone history (`bhyve`) | | | | | |
|  | ↳ `switch.front_yard_front_yard_program` — Front Yard program (`bhyve`) | | | | | |
|  | ↳ `switch.front_yard_rain_delay` — Rain delay (`bhyve`) | | | | | |
|  | ↳ `switch.front_yard_smart_watering` — Smart watering (`bhyve`) | | | | | |
|  | ↳ `switch.front_yard_zone` — Front Yard Faucet Zone (`bhyve`) | | | | | |
|  | ↳ `valve.front_yard_zone` — Zone (`bhyve`) | | | | | |
| [ ] | **Front Yard Hub** | Orbit BHyve / BH1-0001 / 0095 | `—` | `f89e80367028f3e390b6590597e7cadd` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.front_yard_hub_connected` — Connected (`bhyve`) | | | | | |
| [ ] | **Wi-Fi Hub** | Orbit BHyve / BH1G2-0002 / 0056 | `—` | `f4da009b1070f2c224a33e68c63411e2` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.wi_fi_hub_connected` — Connected (`bhyve`) | | | | | |

### `cast` (4 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Bedroom TV** | Hisense / HiSmart 4K ATV4 | `—` | `865cc5dbbb759ac6423889f0e7fb495e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.bedroom_tv` — — (`cast`) | | | | | |
| [ ] | **SHIELD** | NVIDIA / SHIELD Android TV | `—` | `2fbd861a27d0dc01089dbe240cbc50c7` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.shield` — — (`cast`) | | | | | |
| [ ] | **SHIELD** | NVIDIA / SHIELD Android TV | `—` | `751e95662a9ceb2a6a6ee134d9613105` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.shield_2` — — (`cast`) | | | | | |
| [ ] | **Theater SHIELD** | NVIDIA / SHIELD Android TV | `—` | `dd3ac5cb7c39d2ecffa60cfa5f4e0401` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.theater_shield` — — (`cast`) | | | | | |

### `evershelf` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **EverShelf** | EverShelf / Pantry Manager | `kitchen` | `c7776ac42588efc908125cc61195101c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.evershelf_backup_overdue` — Backup Overdue (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.evershelf_bring_connected` — Bring! Connected (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.evershelf_expiring_today_urgent` — Expiring Today (Urgent) (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.evershelf_has_expired_items` — Has Expired Items (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.evershelf_has_expiring_items` — Has Expiring Items (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.evershelf_price_tracking` — Price Tracking (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.evershelf_shopping_list_active` — Shopping List Active (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.kitchen_evershelf_ontology_provider_unavailable` — Ontology Provider Unavailable (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.kitchen_evershelf_processing_active` — Processing Active (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.kitchen_evershelf_processing_problem` — Processing Problem (`evershelf`) | | | | | |
|  | ↳ `binary_sensor.kitchen_evershelf_recipe_scores_stale` — Recipe Scores Stale (`evershelf`) | | | | | |
|  | ↳ `button.evershelf_clear_expired` — Clear Expired (`evershelf`) | | | | | |
|  | ↳ `button.evershelf_refresh` — Refresh (`evershelf`) | | | | | |
|  | ↳ `button.evershelf_refresh_prices` — Refresh Prices (`evershelf`) | | | | | |
|  | ↳ `button.evershelf_suggest_recipe` — Suggest Recipe (`evershelf`) | | | | | |
|  | ↳ `button.evershelf_sync_smart_shopping` — Sync Smart Shopping (`evershelf`) | | | | | |
|  | ↳ `calendar.evershelf_expiry_calendar` — Expiry Calendar (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_ai_calls_this_month` — AI Calls This Month (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_days_to_next_expiry` — Days to Next Expiry (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_expired_items` — Expired Items (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_expiring_in_3_days` — Expiring in 3 Days (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_expiring_soon` — Expiring Soon (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_expiring_today` — Expiring Today (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_items_in_freezer` — Items in Freezer (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_items_in_fridge` — Items in Fridge (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_items_in_pantry` — Items in Pantry (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_last_backup` — Last Backup (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_low_stock_items` — Low Stock Items (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_opened_items` — Opened Items (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_out_of_stock_items` — Out of Stock Items (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_shopping_list` — Shopping List (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_shopping_total` — Shopping Total (`evershelf`) | | | | | |
|  | ↳ `sensor.evershelf_total_items` — Total Items (`evershelf`) | | | | | |
|  | ↳ `sensor.kitchen_evershelf_items_in_cabinet` — Items in Cabinet (`evershelf`) | | | | | |
|  | ↳ `sensor.kitchen_evershelf_items_in_spice_rack` — Items in Spice Rack (`evershelf`) | | | | | |
|  | ↳ `sensor.kitchen_evershelf_pending_processing_work` — Pending Processing Work (`evershelf`) | | | | | |
|  | ↳ `sensor.kitchen_evershelf_processing_phase` — Processing Phase (`evershelf`) | | | | | |
|  | ↳ `sensor.kitchen_evershelf_recipe_score_revision` — Recipe Score Revision (`evershelf`) | | | | | |
|  | ↳ `sensor.kitchen_evershelf_source_ingredient_ontology_coverage` — Source Ingredient Ontology Coverage (`evershelf`) | | | | | |
|  | ↳ `text.evershelf_quick_add_to_shopping` — Quick Add to Shopping (`evershelf`) | | | | | |
|  | ↳ `todo.evershelf_shopping_list` — Shopping List (`evershelf`) | | | | | |

### `flair` (28 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Dining Room Flair Room** | Flair / Room | `dining_room` | `665769f6358442acf833b73ddeade3f0` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.dining_room_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.dining_room_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.dining_room_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.dining_room_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Dining Room Vent** | Flair / Vent | `dining_room` | `965342b25574f34c991dd3af6aee15e2` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.dining_room_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.dining_room_vent_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.dining_room_3219_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.dining_room_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.dining_room_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.dining_room_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.dining_room_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.dining_room_vent_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Guest Bathroom Flair Room** | Flair / Room | `guest_bathroom` | `52eea3b205bfc401686d70366413fc4f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.guest_bathroom_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.guest_bathroom_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.guest_bathroom_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.guest_bathroom_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Guest Bathroom Vent** | Flair / Vent | `guest_bathroom` | `30f5fe96aefbf69eb9c50f96b59f219e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_bathroom_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.guest_bathroom_vent_vent` — Guest Bathroom Vent (`flair`) | | | | | |
|  | ↳ `sensor.guest_bathroom_7a5b_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.guest_bathroom_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.guest_bathroom_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.guest_bathroom_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.guest_bathroom_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.guest_bathroom_vent_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Guest Room Flair Room** | Flair / Room | `guest_room` | `635a0a1698f4331eefe9d9f6a05bfcfb` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.guest_room_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.guest_room_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.guest_room_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.guest_room_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Guest Room Vent** | Flair / Vent | `guest_room` | `6978154f9ff6159527b5d665530daab8` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_room_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.guest_room_vent_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.guest_room_7655_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.guest_room_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.guest_room_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.guest_room_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.guest_room_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.guest_room_vent_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Flair Home** | Flair / Structure | `gym` | `d011f669817193ff89c617e5274f556e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.flair_home_clear_home_away_hold` — Clear home/away hold (`flair`) | | | | | |
|  | ↳ `button.flair_home_reverse_home_away_hold` — Reverse home/away hold (`flair`) | | | | | |
|  | ↳ `climate.flair_home_structure` — Structure (`flair`) | | | | | |
|  | ↳ `number.flair_home_away_temperature_maximum` — Away temperature maximum (`flair`) | | | | | |
|  | ↳ `number.flair_home_away_temperature_minimum` — Away temperature minimum (`flair`) | | | | | |
|  | ↳ `select.flair_home_active_schedule` — Active schedule (`flair`) | | | | | |
|  | ↳ `select.flair_home_away_mode` — Away Mode (`flair`) | | | | | |
|  | ↳ `select.flair_home_default_hold_duration` — Default hold duration (`flair`) | | | | | |
|  | ↳ `select.flair_home_home_away` — Home/Away (`flair`) | | | | | |
|  | ↳ `select.flair_home_home_away_mode_set_by` — Home/Away mode set by (`flair`) | | | | | |
|  | ↳ `select.flair_home_set_point_controller` — Set point controller (`flair`) | | | | | |
|  | ↳ `select.flair_home_system_mode` — System mode (`flair`) | | | | | |
|  | ↳ `sensor.flair_home_home_away_holding_until` — Home/Away holding until (`flair`) | | | | | |
| [ ] | **Gym Flair Room** | Flair / Room | `gym` | `5ce247479626374353b4e52985afadeb` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.gym_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.gym_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.gym_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.gym_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Gym Vent** | Flair / Vent | `gym` | `993f81bd13014ec45ea09a3dda709469` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.gym_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.gym_vent_vent` — Gym Vent (`flair`) | | | | | |
|  | ↳ `sensor.gym_ecec_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.gym_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.gym_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.gym_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.gym_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.gym_vent_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Kitchen Flair Room** | Flair / Room | `kitchen` | `7aa3226c80b95065ac1c15cf7eae1349` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.kitchen_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.kitchen_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.kitchen_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.kitchen_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Kitchen Vent** | Flair / Vent | `kitchen` | `16ed9136ae1ad46be0aacb955899f632` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.kitchen_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.kitchen_vent_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.kitchen_c19f_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.kitchen_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.kitchen_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.kitchen_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.kitchen_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.kitchen_vent_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Living Room Flair Room** | Flair / Room | `living_room` | `5449ef3c32a74a263926cf64b5b5c954` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.living_room_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.living_room_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.living_room_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.living_room_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Living Room Vent 1** | Flair / Vent | `living_room` | `a5363341bdf004252b44fc04e88c1a91` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_vent_1_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.living_room_vent_1_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.living_room_5808_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_1_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_1_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_1_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_1_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_1_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Living Room Vent 2** | Flair / Vent | `living_room` | `cb75cd98698718e33d8639f91f3130a1` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_vent_2_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.living_room_vent_2_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.living_room_ccbb_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_2_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_2_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_2_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_2_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.living_room_vent_2_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Master Bathroom Flair Room** | Flair / Room | `master_bathroom` | `9e35b98b4ea0625cbb90b8828f5f6768` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bathroom_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.master_bathroom_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.master_bathroom_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Master Bathroom Vent** | Flair / Puck | `master_bathroom` | `9c94f70e75aa0dd4109b5ff39b62411b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bathroom_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `number.master_bathroom_vent_set_point_lower_limit` — Set point lower limit (`flair`) | | | | | |
|  | ↳ `number.master_bathroom_vent_set_point_upper_limit` — Set point upper limit (`flair`) | | | | | |
|  | ↳ `number.master_bathroom_vent_temperature_calibration` — Temperature calibration (`flair`) | | | | | |
|  | ↳ `select.master_bathroom_vent_background_color` — Background color (`flair`) | | | | | |
|  | ↳ `select.master_bathroom_vent_temperature_scale` — Temperature scale (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_humidity` — Humidity (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_light` — Light (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_pressure` — Pressure (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_temperature` — Temperature (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_voltage` — Voltage (`flair`) | | | | | |
|  | ↳ `switch.master_bathroom_vent_lock_puck` — Lock puck (`flair`) | | | | | |
| [ ] | **Master Bathroom Vent** | Flair / Vent | `master_bathroom` | `e24dd68a28f5bc6e3f2a0da5a8b6faf5` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bathroom_vent_connection_status_2` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.master_bathroom_vent_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_9ead_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_associated_gateway_2` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_rssi_2` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.master_bathroom_vent_voltage_2` — Voltage (`flair`) | | | | | |
| [ ] | **Master Bedroom Flair Room** | Flair / Room | `master_bedroom` | `618137eb38d0cf14beb42a67e05da76a` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bedroom_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.master_bedroom_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.master_bedroom_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Master Bedroom Vent 2** | Flair / Vent | `master_bedroom` | `8ba9d76e730930ce38f8288d1dd5f30a` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_vent_2_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.master_bedroom_vent_2_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_dcaa_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_2_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_2_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_2_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_2_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_2_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Master Bedroom Vent 3** | Flair / Vent | `master_bedroom` | `d8009d8a792546dbc39c6e17c636933c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_vent_3_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.master_bedroom_vent_3_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_456d_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_3_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_3_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_3_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_3_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.master_bedroom_vent_3_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Music Room Flair Room** | Flair / Room | `music_room` | `7a9f3333edfdd8ec9e895ab7fbc91909` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.music_room_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.music_room_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.music_room_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Music Room Vent** | Flair / Vent | `music_room` | `f0cb98239b177ab0b14e38b2440eb391` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.music_room_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.music_room_vent_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.music_room_c79a_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.music_room_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.music_room_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.music_room_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.music_room_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.music_room_vent_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Office Flair Room** | Flair / Room | `office` | `84fb698cbe0df26a4c990a0cd028100f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.office_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.office_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.office_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.office_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Office Vent** | Flair / Vent | `office` | `59f8301afdbb6f1d0c3c817ab047ca72` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.office_vent_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.office_vent_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.office_aa68_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.office_vent_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.office_vent_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.office_vent_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.office_vent_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.office_vent_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Theater Room Flair Room** | Flair / Room | `theater_room` | `5584ae89cb2236109a7730f67e5d828e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_flair_room_clear_hold` — Clear hold (`flair`) | | | | | |
|  | ↳ `climate.theater_room_flair_room_room` — Room (`flair`) | | | | | |
|  | ↳ `select.theater_room_flair_room_activity_status` — Activity status (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_flair_room_temperature_holding_until` — Temperature holding until (`flair`) | | | | | |
| [ ] | **Theater Room Vent 1** | Flair / Vent | `theater_room` | `95677e5257f80c1aa06814e3c5f81718` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.theater_room_vent_1_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.theater_room_vent_1_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_da7f_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_1_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_1_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_1_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_1_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_1_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Theater Room Vent 2** | Flair / Vent | `theater_room` | `31982c6dd3b866de08a1efc2da614a69` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.theater_room_vent_2_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `cover.theater_room_vent_2_vent` — Vent (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_0a08_reported_state` — Reported state (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_2_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_2_duct_pressure` — Duct pressure (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_2_duct_temperature` — Duct temperature (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_2_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.theater_room_vent_2_voltage` — Voltage (`flair`) | | | | | |
| [ ] | **Living Room-39a8** | Flair / Puck | `—` | `cfb992333f86a8e43f4984a0e702ca56` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_39a8_connection_status` — Connection status (`flair`) | | | | | |
|  | ↳ `number.living_room_39a8_set_point_lower_limit` — Set point lower limit (`flair`) | | | | | |
|  | ↳ `number.living_room_39a8_set_point_upper_limit` — Set point upper limit (`flair`) | | | | | |
|  | ↳ `number.living_room_39a8_temperature_calibration` — Temperature calibration (`flair`) | | | | | |
|  | ↳ `select.living_room_39a8_background_color` — Background color (`flair`) | | | | | |
|  | ↳ `select.living_room_39a8_temperature_scale` — Temperature scale (`flair`) | | | | | |
|  | ↳ `sensor.living_room_39a8_associated_gateway` — Associated gateway (`flair`) | | | | | |
|  | ↳ `sensor.living_room_39a8_humidity` — Humidity (`flair`) | | | | | |
|  | ↳ `sensor.living_room_39a8_light` — Light (`flair`) | | | | | |
|  | ↳ `sensor.living_room_39a8_pressure` — Pressure (`flair`) | | | | | |
|  | ↳ `sensor.living_room_39a8_rssi` — RSSI (`flair`) | | | | | |
|  | ↳ `sensor.living_room_39a8_temperature` — Temperature (`flair`) | | | | | |
|  | ↳ `sensor.living_room_39a8_voltage` — Voltage (`flair`) | | | | | |
|  | ↳ `switch.living_room_39a8_lock_puck` — Lock puck (`flair`) | | | | | |

### `fordpass` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Mustang Mach-E** | Ford Motor Company / 2021 Mustang Mach-E | `garage` | `3b32a9373d0aeeaa7ffa6f271cb61978` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_doorlock` — Door Lock (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_doorunlock` — Door Unlock (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_evcancel` — EV Charging resume (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_evpause` — EV Charging pause (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_evstart` — EV Charging start (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_extendremotestart` — RC (❄\|☀): Extend Time (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_hafdefault` — Honk & Flash [3 sec.] (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_haflong` — Honk & Flash [5 sec.] (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_hafshort` — Honk & Flash [1 sec.] (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_msgdeleteall` — Messages: Delete All (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_msgdeletelast` — Messages: Delete Last (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_request_refresh` — Remote Sync (`fordpass`) | | | | | |
|  | ↳ `button.fordpass_3fmtk3su5mma09266_update_data` — Local Sync (`fordpass`) | | | | | |
|  | ↳ `device_tracker.fordpass_3fmtk3su5mma09266_tracker` — Vehicle Tracker (`fordpass`) | | | | | |
|  | ↳ `lock.fordpass_3fmtk3su5mma09266_doorlock` — Doors (`fordpass`) | | | | | |
|  | ↳ `number.fordpass_3fmtk3su5mma09266_globalaccurrentlimit` — AC Current Limit (`fordpass`) | | | | | |
|  | ↳ `number.fordpass_3fmtk3su5mma09266_rcctemperature` — RC (❄\|☀): Climate Temperature [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_elvehtargetcharge` — Home: Target charge level (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_elvehtargetchargealt1` — Target charge level [alt location 1] (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_elvehtargetchargealt2` — Target charge level [alt location 2] (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_globaldcpowerlimit` — DC Power Limit (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_globaltargetsoc` — General: Target charge level (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_rccseatfrontleft` — RC (❄\|☀): Seat front left [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_rccseatfrontright` — RC (❄\|☀): Seat front right [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_rccseatrearleft` — RC (❄\|☀): Seat rear left [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_rccseatrearright` — RC (❄\|☀): Seat rear right [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `select.fordpass_3fmtk3su5mma09266_rcctemperature` — RC (❄\|☀): Temperature [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_acceleration` — Acceleration (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_acceleratorpedalposition` — Accelerator Pedal Position (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_alarm` — Alarm (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_battery` — Battery (12V) (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_brakepedalstatus` — Brake Pedal (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_braketorque` — Brake Torque (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_cabintemperature` — Cabin Temperature (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_coolanttemp` — Temperature Coolant (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_deepsleep` — Sleep Mode (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_departureschedules` — Next scheduled Departure (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_deviceconnectivity` — Connectivity (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_doorlock` — Locks (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_doorstatus` — Doors (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_elveh` — EV Data (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_elvehcharging` — EV Charging State (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_elvehchargingpower` — EV Charging Power (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_elvehplug` — EV Plug (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_energytransferlogentry` — EV Last Charging Session (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_enginespeed` — Engine Speed (rev) (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_evccstatus` — EVCC Status Code (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_events` — Events (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_firmwareupdatehistory` — Firmware Update History (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_firmwareupgstatus` — Firmware Update Status (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_gearleverposition` — Gear Lever Position (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_gps` — GPS JSON (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_ignitionstatus` — Ignition (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_indicators` — Indicators (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_lastenergyconsumed` — EV Energy Consumption (last trip) (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_lastfirmwareupdate` — Last Firmware Update (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_lastrefresh` — Last Refresh (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_messages` — Messages (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_metrics` — Metrics (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_odometer` — Odometer (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_oil` — Oil Life (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_otareadiness` — OTA Update Readiness (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_otaschedule` — Next OTA Update Check (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_outsidetemp` — Temperature Outdoors (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_parkingbrakestatus` — Parking Brake (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_remotestartcountdown` — RC (❄\|☀): Remaining Time (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_remotestartstatus` — RC Remote Start (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_seatbelt` — Seat Belts (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_soc` — State of Charge (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_speed` — Speed (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_states` — States (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_tirepressure` — Tire Pressure Monitoring System & Pressures (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_torqueattransmission` — Torque at Transmission (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_vehicles` — Vehicles (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_wheeltorquestatus` — Wheel Torque (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_windowposition` — Window Positions (`fordpass`) | | | | | |
|  | ↳ `sensor.fordpass_3fmtk3su5mma09266_yawrate` — Yaw Rate (`fordpass`) | | | | | |
|  | ↳ `switch.fordpass_3fmtk3su5mma09266_autosoftwareupdates` — Automatic Software Updates (`fordpass`) | | | | | |
|  | ↳ `switch.fordpass_3fmtk3su5mma09266_departuretimes` — Departure Times (`fordpass`) | | | | | |
|  | ↳ `switch.fordpass_3fmtk3su5mma09266_elvehcharge` — EV Charging (Pause) (`fordpass`) | | | | | |
|  | ↳ `switch.fordpass_3fmtk3su5mma09266_ignition` — RC (❄\|☀): Start [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `switch.fordpass_3fmtk3su5mma09266_rccdefrostfront` — RC (❄\|☀): Heated Windshield [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `switch.fordpass_3fmtk3su5mma09266_rccdefrostrear` — RC (❄\|☀): Rear Defrost [RemoteControl] (`fordpass`) | | | | | |
|  | ↳ `switch.fordpass_3fmtk3su5mma09266_rccsteeringwheel` — RC (❄\|☀): Steering Wheel Heating [RemoteControl] (`fordpass`) | | | | | |

### `frigate` (12 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Lower Deck Camera** | Frigate / 5.15.6/0.17.2-3d4dd3a | `back_deck` | `fddd546c1cea333814c48724221ace8a` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.lower_deck_camera_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.lower_deck_camera_motion` — Motion (`frigate`) | | | | | |
|  | ↳ `binary_sensor.lower_deck_camera_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `camera.lower_deck_camera` — — (`frigate`) | | | | | |
|  | ↳ `image.lower_deck_camera_person` — Person (`frigate`) | | | | | |
|  | ↳ `number.lower_deck_camera_contour_area` — Contour area (`frigate`) | | | | | |
|  | ↳ `number.lower_deck_camera_threshold` — Threshold (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_ab_object_classification` — Ab Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_alex_object_classification` — Alex Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_amazon_object_classification` — Amazon Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_camera_fps` — camera fps (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_capture_cpu_usage` — capture cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_contractors_object_classification` — Contractors Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_delivery_object_classification` — Delivery Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_detect_cpu_usage` — detect cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_detection_fps` — detection fps (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_ffmpeg_cpu_usage` — ffmpeg cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_guests_object_classification` — Guests Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_jason_object_classification` — Jason Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_landscapers_object_classification` — Landscapers Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_last_recognized_face` — Last Recognized Face (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_linnea_object_classification` — Linnea Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_nick_object_classification` — Nick Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_occupancy_classification` — Occupancy Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_omar_object_classification` — Omar Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_person_count` — Person count (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_person_role_object_classification` — Person Role Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_process_fps` — process fps (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_resident_object_classification` — Resident Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_review_status` — Review Status (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_rob_object_classification` — Rob Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_skipped_fps` — skipped fps (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_stephanie_object_classification` — Stephanie Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_camera_stephen_object_classification` — Stephen Object Classification (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_detect` — Detect (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_improve_contrast` — Improve Contrast (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_motion` — Motion (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_object_descriptions` — Object Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_recordings` — Recordings (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_review_alerts` — Review Alerts (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_review_descriptions` — Review Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_review_detections` — Review Detections (`frigate`) | | | | | |
|  | ↳ `switch.lower_deck_camera_snapshots` — Snapshots (`frigate`) | | | | | |
| [ ] | **Front Door Camera** | Frigate / 5.15.6/0.17.2-3d4dd3a | `entryway` | `a4c076a289fc87e042c5d7c08a3b3999` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.front_door_camera_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.front_door_camera_motion` — Motion (`frigate`) | | | | | |
|  | ↳ `binary_sensor.front_door_camera_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `camera.front_door_camera` — — (`frigate`) | | | | | |
|  | ↳ `image.front_door_camera_person` — Person (`frigate`) | | | | | |
|  | ↳ `number.front_door_camera_contour_area` — Contour area (`frigate`) | | | | | |
|  | ↳ `number.front_door_camera_threshold` — Threshold (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_ab_object_classification` — Ab Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_alex_object_classification` — Alex Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_amazon_object_classification` — Amazon Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_camera_fps` — camera fps (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_capture_cpu_usage` — capture cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_contractors_object_classification` — Contractors Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_delivery_object_classification` — Delivery Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_detect_cpu_usage` — detect cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_detection_fps` — detection fps (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_ffmpeg_cpu_usage` — ffmpeg cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_guests_object_classification` — Guests Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_jason_object_classification` — Jason Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_landscapers_object_classification` — Landscapers Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_last_recognized_face` — Last Recognized Face (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_linnea_object_classification` — Linnea Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_nick_object_classification` — Nick Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_occupancy_classification` — Occupancy Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_omar_object_classification` — Omar Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_person_count` — Person count (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_person_role_object_classification` — Person Role Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_process_fps` — process fps (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_resident_object_classification` — Resident Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_review_status` — Review Status (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_rob_object_classification` — Rob Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_skipped_fps` — skipped fps (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_stephanie_object_classification` — Stephanie Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_camera_stephen_object_classification` — Stephen Object Classification (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_detect` — Detect (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_improve_contrast` — Improve Contrast (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_motion` — Motion (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_object_descriptions` — Object Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_recordings` — Recordings (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_review_alerts` — Review Alerts (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_review_descriptions` — Review Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_review_detections` — Review Detections (`frigate`) | | | | | |
|  | ↳ `switch.front_door_camera_snapshots` — Snapshots (`frigate`) | | | | | |
| [ ] | **Frigate** | Frigate / 5.15.6/0.17.2-3d4dd3a | `music_room` | `5cfa10efbe9f24c130d685458a434df7` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.frigate_ab_last_camera` — Ab Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_ab_last_camera_2` — Ab Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_ab_last_camera_3` — Ab Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_alex_last_camera` — Alex Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_alex_last_camera_2` — Alex Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_amazon_last_camera` — Amazon Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_amazon_last_camera_2` — Amazon Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_camera_fps` — camera fps (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_cpu_inference_speed` — Cpu inference speed (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_daria_last_camera` — Daria Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_delivery_last_camera` — Delivery Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_detection_fps` — detection fps (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_dominos_last_camera` — Dominos Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_dustin_last_camera` — Dustin Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_dustin_last_camera_2` — Dustin Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_error_gpu_gpu_load` — Error-Gpu gpu load (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_fede_last_camera` — Fede Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_fede_last_camera_2` — Fede Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_fedex_last_camera` — FedEx Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_food_delivery_last_camera` — Food Delivery Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_grocery_delivery_last_camera` — Grocery Delivery Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_guest_car_last_camera` — Guest Car Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_guest_last_camera` — Guest Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_guest_last_camera_2` — Guest Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_guest_last_camera_3` — Guest Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_guest_last_camera_4` — Guest Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_guest_last_camera_5` — Guest Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_guest_last_camera_6` — Guest Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_jason_last_camera` — Jason Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_jason_last_camera_2` — Jason Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_jason_last_camera_3` — Jason Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_jennifer_last_camera` — Jennifer Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_jennifer_last_camera_2` — Jennifer Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_jenny_last_camera` — Jenny Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_known_car_last_camera` — Known Car Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_known_car_last_camera_2` — Known Car Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_landscapers_last_camera` — Landscapers Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_landscapers_last_camera_2` — Landscapers Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_landscapers_last_camera_3` — Landscapers Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_linnea_last_camera` — Linnea Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_linnea_last_camera_2` — Linnea Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_linnea_last_camera_3` — Linnea Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_mach_e_last_camera` — Mach-E Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_mach_e_last_camera_2` — Mach-E Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_nick_last_camera` — Nick Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_nick_last_camera_2` — Nick Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_nvidia_geforce_gtx_1660_super_gpu_load` — NVIDIA GeForce GTX 1660 SUPER gpu load (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_nvidia_geforce_rtx_5070_gpu_load` — NVIDIA GeForce RTX 5070 gpu load (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_omar_last_camera` — Omar Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_omar_last_camera_2` — Omar Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_omar_last_camera_3` — Omar Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_onnx_inference_speed` — Onnx inference speed (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_pau_last_camera` — Pau Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_process_fps` — process fps (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_resident_last_camera` — Resident Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_resident_last_camera_2` — Resident Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_rob_last_camera` — Rob Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_rob_last_camera_2` — Rob Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_skipped_fps` — skipped fps (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_status` — Status (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_stephanie_last_camera` — Stephanie Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_stephanie_last_camera_2` — Stephanie Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_stephen_last_camera` — Stephen Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_stephen_last_camera_2` — Stephen Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_tito_last_camera` — Tito Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_tito_last_camera_2` — Tito Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_trugreen_last_camera` — TruGreen Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_unknown_last_camera` — Unknown Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_unknown_last_camera_2` — Unknown Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_ups_last_camera` — Ups Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.frigate_uptime` — Uptime (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_andrew_last_camera` — Andrew Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_bryan_last_camera` — Bryan Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_darlene_last_camera` — Darlene Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_dustin_last_camera` — Dustin Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_elise_last_camera` — Elise Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_fedex_last_camera` — FedEx Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_food_delivery_last_camera` — Food Delivery Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_grocery_delivery_last_camera` — Grocery Delivery Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_hayden_last_camera` — Hayden Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_house_cleaners_last_camera` — House Cleaners Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_isabella_last_camera` — Isabella Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_jason_last_camera` — Jason Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_jenny_last_camera` — Jenny Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_jillian_last_camera` — Jillian Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_kat_last_camera` — Kat Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_kirkland_cleaning_last_camera` — Kirkland Cleaning Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_lisa_last_camera` — Lisa Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_luka_last_camera` — Luka Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_marie_pierre_last_camera` — Marie-Pierre Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_nick_last_camera` — Nick Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_none_last_camera` — None Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_simon_last_camera` — Simon Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_steve_last_camera` — Steve Last Camera (`frigate`) | | | | | |
|  | ↳ `sensor.music_room_frigate_ups_last_camera` — Ups Last Camera (`frigate`) | | | | | |
|  | ↳ `update.frigate_server` — Server (`frigate`) | | | | | |
| [ ] | **Upper Deck Camera** | Frigate / 5.15.6/0.17.2-3d4dd3a | `upper_deck` | `25ea10a0a745032c8c8fd0400b915360` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.upper_deck_camera_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.upper_deck_camera_motion` — Motion (`frigate`) | | | | | |
|  | ↳ `binary_sensor.upper_deck_camera_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `camera.upper_deck_camera_2` — — (`frigate`) | | | | | |
|  | ↳ `image.upper_deck_camera_person` — Person (`frigate`) | | | | | |
|  | ↳ `number.upper_deck_camera_contour_area` — Contour area (`frigate`) | | | | | |
|  | ↳ `number.upper_deck_camera_threshold` — Threshold (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_ab_object_classification` — Ab Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_alex_object_classification` — Alex Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_amazon_object_classification` — Amazon Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_camera_fps` — camera fps (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_capture_cpu_usage` — capture cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_contractors_object_classification` — Contractors Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_delivery_object_classification` — Delivery Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_detect_cpu_usage` — detect cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_detection_fps` — detection fps (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_ffmpeg_cpu_usage` — ffmpeg cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_guests_object_classification` — Guests Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_jason_object_classification` — Jason Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_landscapers_object_classification` — Landscapers Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_last_recognized_face` — Last Recognized Face (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_linnea_object_classification` — Linnea Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_nick_object_classification` — Nick Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_occupancy_classification` — Occupancy Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_omar_object_classification` — Omar Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_person_count` — Person count (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_person_role_object_classification` — Person Role Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_process_fps` — process fps (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_resident_object_classification` — Resident Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_review_status` — Review Status (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_rob_object_classification` — Rob Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_skipped_fps` — skipped fps (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_stephanie_object_classification` — Stephanie Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.upper_deck_camera_stephen_object_classification` — Stephen Object Classification (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_detect` — Detect (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_improve_contrast` — Improve Contrast (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_motion` — Motion (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_object_descriptions` — Object Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_recordings` — Recordings (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_review_alerts` — Review Alerts (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_review_descriptions` — Review Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_review_detections` — Review Detections (`frigate`) | | | | | |
|  | ↳ `switch.upper_deck_camera_snapshots` — Snapshots (`frigate`) | | | | | |
| [ ] | **Backyard** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `c05623d521b7d63b4b3a9ef20c54ff19` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.backyard_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.backyard_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `sensor.backyard_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.backyard_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.backyard_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.backyard_person_count` — Person count (`frigate`) | | | | | |
| [ ] | **Deck** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `7236dea6dbfe7898c8856899af82f791` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.deck_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.deck_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `sensor.deck_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.deck_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.deck_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.deck_person_count` — Person count (`frigate`) | | | | | |
| [ ] | **French Drains** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `d278a8879c81b80a0fe51afb35220975` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.french_drains_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.french_drains_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `sensor.french_drains_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.french_drains_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.french_drains_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.french_drains_person_count` — Person count (`frigate`) | | | | | |
| [ ] | **Front Door** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `c19c16230fa3052b1f8d88db370f32f8` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.front_door_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.front_door_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.front_door_person_count` — Person count (`frigate`) | | | | | |
| [ ] | **Garage** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `bb52f153152aa4d009a4ba1c4567ccff` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.garage_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.garage_car_occupancy` — Car occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.garage_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `sensor.garage_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_car_active_count` — Car Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_car_count` — Car count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_person_count` — Person count (`frigate`) | | | | | |
| [ ] | **Garage Camera** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `bf2dd255f888938461e7d63331ca08cf` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.garage_camera_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.garage_camera_car_occupancy` — Car occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.garage_camera_motion_2` — Motion (`frigate`) | | | | | |
|  | ↳ `binary_sensor.garage_camera_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `camera.garage_camera` — — (`frigate`) | | | | | |
|  | ↳ `image.garage_camera_car` — Car (`frigate`) | | | | | |
|  | ↳ `image.garage_camera_person` — Person (`frigate`) | | | | | |
|  | ↳ `number.garage_camera_contour_area` — Contour area (`frigate`) | | | | | |
|  | ↳ `number.garage_camera_threshold` — Threshold (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_ab_object_classification` — Ab Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_alex_object_classification` — Alex Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_amazon_object_classification` — Amazon Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_camera_fps` — camera fps (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_capture_cpu_usage` — capture cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_car_active_count` — Car Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_car_count` — Car count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_contractors_object_classification` — Contractors Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_delivery_object_classification` — Delivery Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_detect_cpu_usage` — detect cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_detection_fps` — detection fps (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_ffmpeg_cpu_usage` — ffmpeg cpu usage (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_guest_cars_object_classification` — Guest Cars Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_guests_object_classification` — Guests Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_jason_object_classification` — Jason Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_landscapers_object_classification` — Landscapers Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_last_recognized_face` — Last Recognized Face (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_linnea_object_classification` — Linnea Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_mach_e_object_classification` — Mach-E Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_nick_object_classification` — Nick Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_occupancy_classification` — Occupancy Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_omar_object_classification` — Omar Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_person_count` — Person count (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_person_role_object_classification` — Person Role Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_process_fps` — process fps (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_resident_object_classification` — Resident Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_resident_vehicles_object_classification` — Resident Vehicles Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_review_status` — Review Status (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_rob_alex_toyota_object_classification` — Rob & Alex Toyota Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_rob_object_classification` — Rob Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_skipped_fps` — skipped fps (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_stephanie_object_classification` — Stephanie Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_stephen_object_classification` — Stephen Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_tito_object_classification` — Tito Object Classification (`frigate`) | | | | | |
|  | ↳ `sensor.garage_camera_vehicle_owner_object_classification` — Vehicle Owner Object Classification (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_detect` — Detect (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_improve_contrast` — Improve Contrast (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_motion` — Motion (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_object_descriptions` — Object Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_recordings` — Recordings (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_review_alerts` — Review Alerts (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_review_descriptions` — Review Descriptions (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_review_detections` — Review Detections (`frigate`) | | | | | |
|  | ↳ `switch.garage_camera_snapshots` — Snapshots (`frigate`) | | | | | |
| [ ] | **Lower Deck** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `ebee900546ac8decb25beda656ad265f` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.lower_deck_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.lower_deck_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.lower_deck_person_count` — Person count (`frigate`) | | | | | |
| [ ] | **Side Yard** | Frigate / 5.15.6/0.17.2-3d4dd3a | `—` | `f0765dfce831067de6cd1cd20e010fe5` | `5cfa10efbe9f24c130d685458a434df7` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.side_yard_all_occupancy` — All occupancy (`frigate`) | | | | | |
|  | ↳ `binary_sensor.side_yard_person_occupancy` — Person occupancy (`frigate`) | | | | | |
|  | ↳ `sensor.side_yard_all_active_count` — All Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.side_yard_all_count` — All count (`frigate`) | | | | | |
|  | ↳ `sensor.side_yard_person_active_count` — Person Active Count (`frigate`) | | | | | |
|  | ↳ `sensor.side_yard_person_count` — Person count (`frigate`) | | | | | |

### `google_generative_ai_conversation` (4 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Google AI Conversation** | Google / gemini-3.1-flash-lite | `—` | `84dc2ea7679cbfeee2513dd231b6c4b3` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `conversation.google_ai_conversation` — — (`google_generative_ai_conversation`) | | | | | |
| [ ] | **Google AI STT** | Google / gemini-3.1-flash-lite | `—` | `469b6e972cc6c26ce4aa79eabb87f623` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `stt.google_ai_stt` — — (`google_generative_ai_conversation`) | | | | | |
| [ ] | **Google AI TTS** | Google / gemini-3.1-flash-tts-preview | `—` | `3178bdb1790e05fd1398f3a230225cb5` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `tts.google_ai_tts` — — (`google_generative_ai_conversation`) | | | | | |
| [ ] | **Google AI Task** | Google / gemini-3.1-flash-lite | `—` | `71f16969089101470bf912bd8c937941` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `ai_task.google_ai_task` — — (`google_generative_ai_conversation`) | | | | | |

### `google_translate` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Google Translate en com** | Google / Google Translate TTS | `—` | `ee95e05836ade01f0a1e4fddec6360b5` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `tts.google_translate_en_com` — — (`google_translate`) | | | | | |

### `hacs` (27 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **HACS** | hacs.xyz / 2.0.5 | `living_room` | `14fd88409456ae9bae58f72b3b98a74b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.hacs_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.hacs_update` — Update (`hacs`) | | | | | |
| [ ] | **Adaptive Lighting** | basnijholt, RubenKelevra, th3w1zard1, protyposis / integration | `—` | `30045bf06aa0c50fb5575ae56a37b117` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.adaptive_lighting_pre_release_2` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.adaptive_lighting_update_2` — Update (`hacs`) | | | | | |
| [ ] | **Area Occupancy Detection** | Hankanman / integration | `—` | `08b82645d1fc69909a97713b7d2fb352` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.area_occupancy_detection_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.area_occupancy_detection_update` — Update (`hacs`) | | | | | |
| [ ] | **Battery Maintenance** | SFenton / integration | `—` | `722f8b3326ea41d2a3e6a7fe38d4fee8` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.battery_maintenance_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.battery_maintenance_update` — Update (`hacs`) | | | | | |
| [ ] | **Donetick : Simplify Tasks & Chores, Together.** | meauxt / integration | `—` | `eb508ae94dc5e3f373cb6c5f3746e623` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.donetick_simplify_tasks_chores_together_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.donetick_simplify_tasks_chores_together_update` — Update (`hacs`) | | | | | |
| [ ] | **EverShelf** | SFenton / integration | `—` | `10f9a695d5f9848195fe287529296c11` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.evershelf_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.evershelf_update` — Update (`hacs`) | | | | | |
| [ ] | **Flair** | RobertD502 / integration | `—` | `2699e7634ee63a632c121f98601d3171` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.flair_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.flair_update` — Update (`hacs`) | | | | | |
| [ ] | **Ford™ (aka FordPass) support for EV/PHEV/Petrol/Diesel Ford & Lincoln Vehicles** | marq24, SquidBytes, itchannel / integration | `—` | `1b21fc02a3b2e59b6967509bd0f73dff` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.fordpass_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.fordpass_update` — Update (`hacs`) | | | | | |
| [ ] | **Frigate** | blakeblackshear, dermotduffy, NickM-27 / integration | `—` | `88f92b593f2e7a469c63c1d82c176fc0` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.frigate_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.frigate_update` — Update (`hacs`) | | | | | |
| [ ] | **Frosted Glass Theme** | wessamlauf / theme | `—` | `8bcb7f3d4b8320781adfad1658fb87c6` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.frosted_glass_theme_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.frosted_glass_theme_update` — Update (`hacs`) | | | | | |
| [ ] | **Hisense TV** | ltomes / integration | `—` | `2ca86345085da045ab6fb181ee2204fb` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.hisense_tv_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.hisense_tv_update` — Update (`hacs`) | | | | | |
| [ ] | **Home Agent** | aradlein / integration | `—` | `b075e66dab6edd2e46b55b333203ee50` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.home_agent_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.home_agent_update` — Update (`hacs`) | | | | | |
| [ ] | **Kiosk Mode** | NemesisRE / plugin | `—` | `71426f0f49c9639835630a6491fbc81e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.kiosk_mode_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.kiosk_mode_update` — Update (`hacs`) | | | | | |
| [ ] | **Orbit BHyve** | sebr / integration | `—` | `45488a1ef4e31bca1535505229b9fbd0` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.orbit_bhyve_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.orbit_bhyve_update` — Update (`hacs`) | | | | | |
| [ ] | **Philips Hue Play Sync devices** | mvdwetering / integration | `—` | `4926ff6fad94c2c8bd4a0daf66149750` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.philips_hue_play_hdmi_sync_box_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.philips_hue_play_hdmi_sync_box_update` — Update (`hacs`) | | | | | |
| [ ] | **Pirate Weather** | alexander0042 / integration | `—` | `ed805913ef136dce87a2fe369976e82c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.pirate_weather_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.pirate_weather_update` — Update (`hacs`) | | | | | |
| [ ] | **Presence Based Lighting** | sfenton / integration | `—` | `e705c0086fbc0c22bb3622685de270be` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.presence_based_lighting_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.presence_based_lighting_update` — Update (`hacs`) | | | | | |
| [ ] | **Real last changed** | HamletDuFromage / integration | `—` | `4b17abad940fd7c74073eee11e8d53fa` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.real_last_changed_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.real_last_changed_update` — Update (`hacs`) | | | | | |
| [ ] | **Sony Projector ADCP** | Bcukier / integration | `—` | `47b7ab2288d070c62300bd99c02c7ac3` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.sony_projector_adcp_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.sony_projector_adcp_update` — Update (`hacs`) | | | | | |
| [ ] | **Thermostat Contact Sensors** | sfentress / integration | `—` | `8a19a305147be16639570be37ef053d8` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.thermostat_contact_sensors_update` — Update (`hacs`) | | | | | |
| [ ] | **Traeger WiFIRE** | johnvoipguy / integration | `—` | `d6a6332bd94d893507ce81ec9b803814` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.traeger_wifire_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.traeger_wifire_update` — Update (`hacs`) | | | | | |
| [ ] | **Transit Tracker** | SFenton / integration | `—` | `b6259680b2db4b4e6b877ddfba9d0f57` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.transit_tracker_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.transit_tracker_update` — Update (`hacs`) | | | | | |
| [ ] | **Valetudo** | hypfer / integration | `—` | `68a0303542805968d41e96696763421a` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.valetudo_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.valetudo_update` — Update (`hacs`) | | | | | |
| [ ] | **Valetudo Map Card** | Hypfer / plugin | `—` | `5ed6784e2c97461df1ed9d899813db18` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.valetudo_map_card_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.valetudo_map_card_update` — Update (`hacs`) | | | | | |
| [ ] | **Valetudo Vacuum Coordinator** | sfenton / integration | `—` | `24422ffb553f333248dd8522cdc47bce` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.valetudo_vacuum_coordinator_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.valetudo_vacuum_coordinator_update` — Update (`hacs`) | | | | | |
| [ ] | **WebRTC Camera** | AlexxIT / integration | `—` | `44132584e89769f4efb01a7ac5fc1218` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.webrtc_camera_pre_release_2` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.webrtc_camera_update_2` — Update (`hacs`) | | | | | |
| [ ] | **iOS Themes - Dark Mode and Light Mode** | basnijholt / theme | `—` | `b561b2982a793d2bb1f3337200baf2e2` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.ios_themes_dark_mode_and_light_mode_pre_release` — Pre-release (`hacs`) | | | | | |
|  | ↳ `update.ios_themes_dark_mode_and_light_mode_update` — Update (`hacs`) | | | | | |

### `hassio` (18 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Advanced SSH & Web Terminal** | Home Assistant Community Apps / Home Assistant App / 24.1.3 | `—` | `9bbbbdcf53133af61c5d73fd70f5083c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.advanced_ssh_web_terminal_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.advanced_ssh_web_terminal_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.advanced_ssh_web_terminal_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.advanced_ssh_web_terminal_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.advanced_ssh_web_terminal_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.advanced_ssh_web_terminal` — — (`hassio`) | | | | | |
|  | ↳ `update.advanced_ssh_web_terminal_update` — Update (`hassio`) | | | | | |
| [ ] | **Cloudflared** | Cloudflared / Home Assistant App / 7.0.14 | `—` | `e7f0040375b0bec68055284644158e7d` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.cloudflared_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.cloudflared_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.cloudflared_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.cloudflared_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.cloudflared_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.cloudflared` — — (`hassio`) | | | | | |
|  | ↳ `update.cloudflared_update` — Update (`hassio`) | | | | | |
| [ ] | **File editor** | Official apps / Home Assistant App / 6.1.0 | `—` | `110b4d0110b0d89ad904dc813bce0c51` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.file_editor_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.file_editor_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.file_editor_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.file_editor_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.file_editor_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.file_editor` — — (`hassio`) | | | | | |
|  | ↳ `update.file_editor_update` — Update (`hassio`) | | | | | |
| [ ] | **Get HACS** | Home Assistant Community Store / Home Assistant App / 1.3.1 | `—` | `4cac7215b0b216070e5393b1a6e7cb55` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.get_hacs_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.get_hacs_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.get_hacs_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.get_hacs_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.get_hacs_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.get_hacs` — — (`hassio`) | | | | | |
|  | ↳ `update.get_hacs_update` — Update (`hassio`) | | | | | |
| [ ] | **Home Assistant Core** | Home Assistant / Home Assistant Core / 2026.9.1 | `—` | `0988bdf9319351caf6a3f59d9ddda89b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.home_assistant_core_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_core_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `update.home_assistant_core_update` — Update (`hassio`) | | | | | |
| [ ] | **Home Assistant Host** | Home Assistant / Home Assistant Host | `—` | `b7787eeb44155fd3debe6b9c81bd3bdc` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.home_assistant_host_apparmor_version` — AppArmor version (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_host_disk_free` — Disk free (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_host_disk_total` — Disk total (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_host_disk_used` — Disk used (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_host_os_agent_version` — OS Agent version (`hassio`) | | | | | |
| [ ] | **Home Assistant MCP Server** | Home Assistant MCP Server / Home Assistant App / 8.4.3 | `—` | `ca68c1696a0a889eba9d35f561cb29c7` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.home_assistant_mcp_server_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_mcp_server_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_mcp_server_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_mcp_server_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_mcp_server_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.home_assistant_mcp_server` — — (`hassio`) | | | | | |
|  | ↳ `update.home_assistant_mcp_server_update` — Update (`hassio`) | | | | | |
| [ ] | **Home Assistant Operating System** | Home Assistant / Home Assistant Operating System / 18.2 | `—` | `eb5f9bfbb3f7a99ea8bab68030342747` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.home_assistant_operating_system_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_operating_system_version` — Version (`hassio`) | | | | | |
|  | ↳ `update.home_assistant_operating_system_update` — Update (`hassio`) | | | | | |
| [ ] | **Home Assistant Supervisor** | Home Assistant / Home Assistant Supervisor / 2026.08.0 | `—` | `401390203fcac517369b0c0d08f4aa4b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.home_assistant_supervisor_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_supervisor_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `update.home_assistant_supervisor_update` — Update (`hassio`) | | | | | |
| [ ] | **Home-Assistant-Matter-Hub** | Addons by t0bst4r / Home Assistant App / 3.0.4 | `—` | `284c853a89ca6351fb8a7af08ea12f8e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.home_assistant_matter_hub_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_matter_hub_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_matter_hub_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_matter_hub_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.home_assistant_matter_hub_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.home_assistant_matter_hub` — — (`hassio`) | | | | | |
|  | ↳ `update.home_assistant_matter_hub_update` — Update (`hassio`) | | | | | |
| [ ] | **Homebridge** | tronikos' Home Assistant add-ons repository / Home Assistant App / 2026-09-02 | `—` | `36e58d975b89af8173f9ac1fd20c36d1` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.homebridge_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.homebridge_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.homebridge_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.homebridge_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.homebridge_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.homebridge` — — (`hassio`) | | | | | |
|  | ↳ `update.homebridge_update` — Update (`hassio`) | | | | | |
| [ ] | **Matter Server** | Official apps / Home Assistant App / 9.2.0 | `—` | `92ca95a6af5a7aed1b5235dfc517b951` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.matter_server_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.matter_server_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.matter_server_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.matter_server_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.matter_server_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.matter_server` — — (`hassio`) | | | | | |
|  | ↳ `update.matter_server_update` — Update (`hassio`) | | | | | |
| [ ] | **Mosquitto broker** | Official apps / Home Assistant App / 7.1.0 | `—` | `a9e04ba01e29453d53f468932163ad67` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.mosquitto_broker_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.mosquitto_broker_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.mosquitto_broker_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.mosquitto_broker_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.mosquitto_broker_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.mosquitto_broker` — — (`hassio`) | | | | | |
|  | ↳ `update.mosquitto_broker_update` — Update (`hassio`) | | | | | |
| [ ] | **OpenCode** | OpenCode / Home Assistant App / 2.5.4 | `—` | `04737dd5d0ecbf37ecc6b0b0eca012ed` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.opencode_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.opencode_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.opencode_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.opencode_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.opencode_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.opencode` — — (`hassio`) | | | | | |
|  | ↳ `update.opencode_update` — Update (`hassio`) | | | | | |
| [ ] | **Samba share** | Official apps / Home Assistant App / 12.10.0 | `—` | `95fe42f28f98e3b9c3be07bddb9ed4c2` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.samba_share_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.samba_share_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.samba_share_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.samba_share_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.samba_share_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.samba_share` — — (`hassio`) | | | | | |
|  | ↳ `update.samba_share_update` — Update (`hassio`) | | | | | |
| [ ] | **Studio Code Server** | Home Assistant Community Apps / Home Assistant App / 7.0.0 | `—` | `06074b2fbef67c53fcf32a495b77118c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.studio_code_server_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.studio_code_server_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.studio_code_server_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.studio_code_server_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.studio_code_server_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.studio_code_server` — — (`hassio`) | | | | | |
|  | ↳ `update.studio_code_server_update` — Update (`hassio`) | | | | | |
| [ ] | **Terminal & SSH** | Official apps / Home Assistant App / 10.4.0 | `—` | `b28a58004e8ce4c90371cba5b08e8760` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.terminal_ssh_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.terminal_ssh_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.terminal_ssh_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.terminal_ssh_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.terminal_ssh_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.terminal_ssh` — — (`hassio`) | | | | | |
|  | ↳ `update.terminal_ssh_update` — Update (`hassio`) | | | | | |
| [ ] | **Zigbee2MQTT** | Home Assistant App: Zigbee2MQTT / Home Assistant App / 2.14.1-1 | `—` | `26eddc2065746a83e2ac1cfc5d34aab0` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.zigbee2mqtt_running` — Running (`hassio`) | | | | | |
|  | ↳ `sensor.zigbee2mqtt_cpu_percent` — CPU percent (`hassio`) | | | | | |
|  | ↳ `sensor.zigbee2mqtt_memory_percent` — Memory percent (`hassio`) | | | | | |
|  | ↳ `sensor.zigbee2mqtt_newest_version` — Newest version (`hassio`) | | | | | |
|  | ↳ `sensor.zigbee2mqtt_version` — Version (`hassio`) | | | | | |
|  | ↳ `switch.zigbee2mqtt` — — (`hassio`) | | | | | |
|  | ↳ `update.zigbee2mqtt_update` — Update (`hassio`) | | | | | |

### `hisense_tv` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Music Room TV** | Hisense / SmartTV 4K FFM / 2026.03.18 | `music_room` | `0552bb4257743877afce67d985d20946` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_music_room_tv_pair_adb` — Pair ADB (`hisense_tv`) | | | | | |
|  | ↳ `media_player.music_room_music_room_tv` — — (`hisense_tv`) | | | | | |
|  | ↳ `sensor.music_room_music_room_tv_display_info` — Display Info (`hisense_tv`) | | | | | |

### `home_connect` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Dishwasher** | Bosch / SHX78CC5UC | `kitchen` | `5d84d74085dc13ab2253b2bc0d6aaea1` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.dishwasher_connectivity` — Connectivity (`home_connect`) | | | | | |
|  | ↳ `binary_sensor.dishwasher_remote_control` — Remote control (`home_connect`) | | | | | |
|  | ↳ `binary_sensor.dishwasher_remote_start` — Remote start (`home_connect`) | | | | | |
|  | ↳ `button.dishwasher_resume_program` — Resume program (`home_connect`) | | | | | |
|  | ↳ `button.dishwasher_stop_program` — Stop program (`home_connect`) | | | | | |
|  | ↳ `number.dishwasher_start_in_relative` — Start in relative (`home_connect`) | | | | | |
|  | ↳ `select.dishwasher_active_program` — Active program (`home_connect`) | | | | | |
|  | ↳ `select.dishwasher_selected_program` — Selected program (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_door` — Door (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_operation_state` — Operation state (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_program_aborted` — Program aborted (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_program_finish_time` — Program finish time (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_program_finished` — Program finished (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_program_progress` — Program progress (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_rinse_aid_nearly_empty` — Rinse aid nearly empty (`home_connect`) | | | | | |
|  | ↳ `sensor.dishwasher_salt_nearly_empty` — Salt nearly empty (`home_connect`) | | | | | |
|  | ↳ `sensor.kitchen_dishwasher_machine_care_and_filter_cleaning_reminder` — Machine care and filter cleaning reminder (`home_connect`) | | | | | |
|  | ↳ `sensor.kitchen_dishwasher_machine_care_and_low_maintenance_filter_cleaning_reminder` — Machine care and low maintenance filter cleaning reminder (`home_connect`) | | | | | |
|  | ↳ `sensor.kitchen_dishwasher_machine_care_reminder` — Machine care reminder (`home_connect`) | | | | | |
|  | ↳ `sensor.kitchen_dishwasher_program_blocked_salt_lack` — Program blocked - salt lack (`home_connect`) | | | | | |
|  | ↳ `sensor.kitchen_dishwasher_rinse_aid_lack` — Rinse aid lack (`home_connect`) | | | | | |
|  | ↳ `sensor.kitchen_dishwasher_salt_lack` — Salt lack (`home_connect`) | | | | | |
|  | ↳ `sensor.kitchen_dishwasher_smart_filter_cleaning_reminder` — Smart filter cleaning reminder (`home_connect`) | | | | | |
|  | ↳ `switch.dishwasher_half_load` — Half load (`home_connect`) | | | | | |
|  | ↳ `switch.dishwasher_hygiene` — Hygiene + (`home_connect`) | | | | | |
|  | ↳ `switch.dishwasher_power` — Power (`home_connect`) | | | | | |
|  | ↳ `switch.dishwasher_zeolite_dry` — Zeolite dry (`home_connect`) | | | | | |

### `homekit` (3 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Main Bridge** | Home Assistant / HomeBridge | `living_room` | `01be8e15c15b4a3ec69b6fa54ec0ae41` | `—` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Button Bridge** | Home Assistant / HomeBridge | `—` | `1cd1dbbe74bee8479d4d478de3114097` | `—` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Doorbell Bridge:21063** | Home Assistant / HomeBridge | `—` | `12b01e42f14b420c55553545a07a57b3` | `—` | `—` |
|  | _No entities reported by the registry response._ | | | | | |

### `homekit_controller:accessory-id` (56 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Lower Deck Camera** | Aqara / CH-C03E / 4.5.30 | `back_deck` | `57a6befb2a1128ce55f29558c782c658` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `alarm_control_panel.camera_hub_g5pro_c2d7_security_system` — Camera-Hub-G5Pro-C2D7 Security System (`homekit_controller`) | | | | | |
|  | ↳ `binary_sensor.camera_hub_g5pro_c2d7_motion_sensor` — Camera-Hub-G5Pro-C2D7 Motion Sensor (`homekit_controller`) | | | | | |
|  | ↳ `button.camera_hub_g5pro_c2d7_identify` — Camera-Hub-G5Pro-C2D7 Identify (`homekit_controller`) | | | | | |
|  | ↳ `camera.camera_hub_g5pro_c2d7` — Camera-Hub-G5Pro-C2D7 (`homekit_controller`) | | | | | |
|  | ↳ `light.camera_hub_g5pro_c2d7_lightbulb` — Camera-Hub-G5Pro-C2D7 Lightbulb (`homekit_controller`) | | | | | |
|  | ↳ `switch.backyard_lower_deck_camera_camera_hub_g5pro_c2d7_pairing_mode` — Camera-Hub-G5Pro-C2D7 Pairing Mode (`homekit_controller`) | | | | | |
|  | ↳ `switch.camera_hub_g5pro_c2d7_mute` — Camera-Hub-G5Pro-C2D7 Mute (`homekit_controller`) | | | | | |
|  | ↳ `switch.camera_hub_g5pro_c2d7_mute_2` — Camera-Hub-G5Pro-C2D7 Mute (`homekit_controller`) | | | | | |
| [ ] | **Upper Deck Camera** | Aqara / CH-C03E / 4.5.30 | `back_deck` | `66afcaeb681c76f3410b4989e1f46c28` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `alarm_control_panel.camera_hub_g5pro_4fec_security_system` — Camera-Hub-G5Pro-4FEC Security System (`homekit_controller`) | | | | | |
|  | ↳ `binary_sensor.camera_hub_g5pro_4fec_motion_sensor` — Camera-Hub-G5Pro-4FEC Motion Sensor (`homekit_controller`) | | | | | |
|  | ↳ `button.camera_hub_g5pro_4fec_identify` — Camera-Hub-G5Pro-4FEC Identify (`homekit_controller`) | | | | | |
|  | ↳ `camera.upper_deck_camera` — Upper Deck Camera (`homekit_controller`) | | | | | |
|  | ↳ `light.camera_hub_g5pro_4fec_lightbulb` — Camera-Hub-G5Pro-4FEC Lightbulb (`homekit_controller`) | | | | | |
|  | ↳ `switch.backyard_upper_deck_camera_camera_hub_g5pro_4fec_pairing_mode` — Camera-Hub-G5Pro-4FEC Pairing Mode (`homekit_controller`) | | | | | |
|  | ↳ `switch.camera_hub_g5pro_4fec_mute` — Camera-Hub-G5Pro-4FEC Mute (`homekit_controller`) | | | | | |
|  | ↳ `switch.camera_hub_g5pro_4fec_mute_2` — Camera-Hub-G5Pro-4FEC Mute (`homekit_controller`) | | | | | |
| [ ] | **Doorbell** | Aqara / CH-C11E / 4.5.20 | `entryway` | `44eeb7eb947d899b186393bb89ffc6bd` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `alarm_control_panel.doorbell_repeater_d0fc_security_system` — Repeater-D0FC Security System (`homekit_controller`) | | | | | |
|  | ↳ `binary_sensor.doorbell_repeater_d0fc_motion_sensor` — Repeater-D0FC Motion Sensor (`homekit_controller`) | | | | | |
|  | ↳ `button.doorbell_repeater_d0fc_identify` — Repeater-D0FC Identify (`homekit_controller`) | | | | | |
|  | ↳ `camera.doorbell_camera` — Doorbell Camera (`homekit_controller`) | | | | | |
|  | ↳ `event.doorbell_repeater_d0fc_video_doorbell` — Repeater-D0FC Video Doorbell (`homekit_controller`) | | | | | |
|  | ↳ `sensor.doorbell_repeater_d0fc_battery_sensor` — Repeater-D0FC Battery Sensor (`homekit_controller`) | | | | | |
|  | ↳ `switch.doorbell_repeater_d0fc_mute` — Repeater-D0FC Mute (`homekit_controller`) | | | | | |
|  | ↳ `switch.doorbell_repeater_d0fc_mute_2` — Repeater-D0FC Mute (`homekit_controller`) | | | | | |
|  | ↳ `switch.doorbell_repeater_d0fc_mute_3` — Repeater-D0FC Mute (`homekit_controller`) | | | | | |
|  | ↳ `switch.doorbell_repeater_d0fc_pairing_mode` — Repeater-D0FC Pairing Mode (`homekit_controller`) | | | | | |
| [ ] | **Aqara-Hub-M3-0056** | Aqara / HM-G01E / 4.5.50 | `—` | `16aa8defbe15056f4618b1ac286b3a40` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `alarm_control_panel.aqara_hub_m3_0056_security_system_2` — Security System (`homekit_controller`) | | | | | |
|  | ↳ `button.aqara_hub_m3_0056_identify_2` — Identify (`homekit_controller`) | | | | | |
|  | ↳ `switch.aqara_hub_m3_0056_pairing_mode_2` — Pairing Mode (`homekit_controller`) | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `a1f3325aba9b0ff9bbbbb3be4ce2687f` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `e5956f81c9c2965b200b06376e156459` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `99dd48894d5ad15cc01954e628fab59d` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `e9aa42736bf32c40e2f4ac16fd687ca9` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `963ea17d94556137a1a82c79e76ac43d` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `2c39cdd9e9915ef510394c0b668c4eb2` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `a96b82a868caca0fa4551f2296eaa155` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `c8cfc2c983a5927d3f0893c47c879a84` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `ed9e3decff429f174989d3d4af5ea58c` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Contact Sensor** | Aqara / AS006 / 3 | `—` | `6ac4acc28c0779574ba29abf744764bb` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **HomeKit Dimmer Switch** | Aqara / AK178 / 1722 | `—` | `2c4c7968995528e2f877460c3c018370` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Outlet** | Aqara / AP003 / 17 | `—` | `97c81e574fafdb7322ea38943f80ff58` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `32d595714d5d4285f128b1b363f69511` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `ecfad44018ef1eb9f7dbd01a83da672d` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `db812115e47e27d9887e0ca6d0e484fc` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `8156c577eddfff9e2756fd2c4d62521d` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `c32c876f9741a70134babf4b2ba3b0ca` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `3849baf56f2da76343b9e8e06aed0256` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `cee279ec30a03e83fd7a1e70fa9312a3` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `31c5ceb4cb59441c4ebc47ec52eac576` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `dc63d39d88705560cdb19d2e4ee7f3dc` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `0c696ada66a6d500e8d0926100495b42` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `3f04cf664cb4211678310f63ea8880a7` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `0ca89c8f12677147e2ea1a6fc86ab416` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 5234 | `—` | `ba4e40cfdca4df41a3cd1aa35ae50822` | `44eeb7eb947d899b186393bb89ffc6bd` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Presence Sensor** | Aqara / AS077 / 6542 | `—` | `db8f618037088455c50925debdf6baf3` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `db86eb2650c2f90431d8c0011f934314` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `bebd1b35a7a8da2b9bf36d53b7c249b8` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `5da381face3e63aed1a5e99b415e372d` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `f5aee9dcce85ac9595542e44fba6a426` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `fa7b94bf376b1c15c9d938a744df69dc` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `4dd2dfe9cfcaf4f7c08d357723d874b6` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `0b3f815c67b9d9234818d2fed6942984` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `7579b2462a724be1e349ab0041f66cca` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `938598e120a556aacfc37c67667baf6d` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `29f5d7839c22a87fd4381ac5346f96da` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `4e7b72613a9a327026ed1bdb058b9c34` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `66f3aad2b67c906ddefb471ccf166317` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `70fbecfa25f64440f8a20262d05cbcf3` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `dfff5e406c4197bfaac300cfb1c14605` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `47dc9c1342688005d71c3b8fa21e3c63` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `dd6574763fc43f2d983f76876c2f886d` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK176 / 2123 | `—` | `c7197fbf640e3cf75f3993b5722d3e24` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `f7f97602cb171b1b521d03fd8de8950b` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `6186d7ef978676c554d08c24957de8f2` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK178 / 1722 | `—` | `4f6b0c7cbc1860ce608a9130dea77861` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `ea624f26e3ca9b938052d0f119cf6b99` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `20079eb0a1a0d3886b24fc00e65a2770` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `587495259d06ded319fc9b05f7d642e8` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK178 / 1722 | `—` | `68d8471fb165b41978b1cc7d9d821c69` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK175 / 2326 | `—` | `b72fba41e89fc6bdbf5174e47148f449` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Switch** | Aqara / AK178 / 1722 | `—` | `56a6cd62160f61594073eaabf0991ae5` | `16aa8defbe15056f4618b1ac286b3a40` | `—` |
|  | _No entities reported by the registry response._ | | | | | |

### `hue` (19 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Bedroom** | Signify Netherlands B.V. / Room | `bedroom` | `bdb6aaf1bbd67a9215cd2f7976597424` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Downstairs Hallway** | Signify Netherlands B.V. / Room | `downstairs_hallway` | `86f5e2453cbfd971ab4f0d57c7ab0e2e` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Living Room** | Signify Netherlands B.V. / Room | `living_room` | `b1583c2a561be416b5b197efd8cc9de6` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.living_room_2` — — (`hue`) | | | | | |
| [ ] | **Master Bedroom Closet** | Signify Netherlands B.V. / Room | `master_bedroom_closet` | `a61f2291ad8bc5f4e1785dd3bd7af751` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.master_bedroom_closet_hue_group` — Master Bedroom Closet Hue Group (`hue`) | | | | | |
| [ ] | **Master Bedroom Closet Light** | Signify Netherlands B.V. / Hue ambiance downlight / 1.145.1 | `master_bedroom_closet` | `b1198f7bb4c508dcc26eb265b4e1ad27` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.master_bedroom_closet_light_hue` — Master Bedroom Closet Light Hue (`hue`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_master_bedroom_closet_light_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Hue Bridge Pro** | Signify Netherlands B.V. / Hue Bridge / 1.78.2071401010 | `music_room` | `ddc3b4827a378b9fdd3427844fd79054` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.christmas_lights` — Entertainment area Christmas Lights (`hue`) | | | | | |
|  | ↳ `binary_sensor.hue_bridge_music_room` — Entertainment area Music Room (`hue`) | | | | | |
|  | ↳ `sensor.hue_bridge_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room** | Signify Netherlands B.V. / Room | `music_room` | `0e26486ad1b5d3f73e8384e3fbccefcb` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.music_room` — Music Room Lights (`hue`) | | | | | |
|  | ↳ `scene.music_room_read` — Read (`hue`) | | | | | |
| [ ] | **Music Room Bathroom Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `music_room` | `9e7863a4add67d1848e7c8d528b3e753` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_5` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_5_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Couch Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `music_room` | `2ade7bacc46a37b81123558e40a27542` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_6` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_6_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Drums Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `music_room` | `1557eccc3424044d056b9d61adeff4c8` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_3` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_3_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Hue Play Left** | Signify Netherlands B.V. / Hue Play / 1.163.2 | `music_room` | `11fda4b8463e27c2a1bfa2402840fa0a` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_play_2` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_play_2_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Hue Play Right** | Signify Netherlands B.V. / Hue Play / 1.163.2 | `music_room` | `f41c4262247ee65e86609928282909a2` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_play_1` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_play_1_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Server Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `music_room` | `fdf834e9d1c191d9f5f7771db015c034` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_8` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_8_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room TV Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `music_room` | `4042a3b080ab0b975f0d846f8c4bac9c` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_7` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_7_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Window Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `music_room` | `48d94d5a100cdb3499c0b0e5028eccc9` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_4` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_4_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Office** | Signify Netherlands B.V. / Room | `office` | `02aab0c8f1e65540aaa2c47bd20f8958` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Christmas Lights** | Signify Netherlands B.V. / Festavia string lights / 1.122.8 | `—` | `4a1c86043e9c190caf466b8b3e24bf52` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.festavia_string_lights_1` — — (`hue`) | | | | | |
|  | ↳ `sensor.festavia_string_lights_1_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Door Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `6c120f5247475890e27a66c1963d9f0b` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_1` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_1_zigbee_connectivity` — Zigbee connectivity (`hue`) | | | | | |
| [ ] | **Music Room Fireplace Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `2a1af41450f07259e737cdaf308c15c9` | `ddc3b4827a378b9fdd3427844fd79054` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hue_color_downlight_1_3` — — (`hue`) | | | | | |
|  | ↳ `sensor.hue_color_downlight_1_zigbee_connectivity_2` — Zigbee connectivity (`hue`) | | | | | |

### `huesyncbox` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Music Room Sync Box** | Signify / Philips Hue Play HDMI sync box 8K / 2.5.4 | `music_room` | `9e92d606c4b27661492651b3a53de246` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `number.music_room_music_room_sync_box_brightness` — Brightness (`huesyncbox`) | | | | | |
|  | ↳ `select.music_room_music_room_sync_box_entertainment_area` — Entertainment area (`huesyncbox`) | | | | | |
|  | ↳ `select.music_room_music_room_sync_box_hdmi_input` — HDMI Input (`huesyncbox`) | | | | | |
|  | ↳ `select.music_room_music_room_sync_box_intensity` — Intensity (`huesyncbox`) | | | | | |
|  | ↳ `select.music_room_music_room_sync_box_led_indicator` — Led indicator (`huesyncbox`) | | | | | |
|  | ↳ `select.music_room_music_room_sync_box_sync_mode` — Sync mode (`huesyncbox`) | | | | | |
|  | ↳ `sensor.music_room_music_room_sync_box_hdmi1_status` — HDMI1 status (`huesyncbox`) | | | | | |
|  | ↳ `sensor.music_room_music_room_sync_box_hdmi2_status` — HDMI2 status (`huesyncbox`) | | | | | |
|  | ↳ `sensor.music_room_music_room_sync_box_hdmi3_status` — HDMI3 status (`huesyncbox`) | | | | | |
|  | ↳ `sensor.music_room_music_room_sync_box_hdmi4_status` — HDMI4 status (`huesyncbox`) | | | | | |
|  | ↳ `sensor.sync_box_bridge_connection` — Bridge connection (`huesyncbox`) | | | | | |
|  | ↳ `sensor.sync_box_bridge_id` — Bridge ID (`huesyncbox`) | | | | | |
|  | ↳ `sensor.sync_box_content_info` — Content info (`huesyncbox`) | | | | | |
|  | ↳ `sensor.sync_box_ip_address` — IP address (`huesyncbox`) | | | | | |
|  | ↳ `sensor.sync_box_wifi_quality` — Wifi quality (`huesyncbox`) | | | | | |
|  | ↳ `switch.music_room_music_room_sync_box_light_sync` — Light Sync (`huesyncbox`) | | | | | |
|  | ↳ `switch.music_room_music_room_sync_box_power` — Power (`huesyncbox`) | | | | | |

### `ipp` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **HP Color Laser Printer** | Hewlett-Packard / HP Color LaserJet M452dw / 20160921 | `office` | `50156c0d62af6ba86faf05c66a658a10` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.hp_color_laserjet_m452dw_uptime` — Uptime (`ipp`) | | | | | |
|  | ↳ `sensor.office_hp_color_laser_printer` — — (`ipp`) | | | | | |
|  | ↳ `sensor.office_hp_color_laser_printer_black_cartridge_hp_cf410a` — Black Cartridge HP CF410A (`ipp`) | | | | | |
|  | ↳ `sensor.office_hp_color_laser_printer_cyan_cartridge_hp_cf411a` — Cyan Cartridge HP CF411A (`ipp`) | | | | | |
|  | ↳ `sensor.office_hp_color_laser_printer_magenta_cartridge_hp_cf413a` — Magenta Cartridge HP CF413A (`ipp`) | | | | | |
|  | ↳ `sensor.office_hp_color_laser_printer_yellow_cartridge_hp_cf412a` — Yellow Cartridge HP CF412A (`ipp`) | | | | | |

### `matter` (47 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Dining Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `dining_room` | `90ebd2368b5738309bfa9273a4887caf` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.dining_room_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_7` — Identify (`matter`) | | | | | |
| [ ] | **Dining Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `dining_room` | `e8dc823cc187bca0e217072f8b790d9a` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.dining_room_presence_occupancy` — Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Downstairs Hallway Light** | Signify Netherlands B.V. / Hue ambiance downlight / 1.145.1 | `downstairs_hallway` | `a7fda48d3b61b980e7a453d18724a628` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.downstairs_hallway_light_matter_identify` — Downstairs Hallway Light Matter Identify (`matter`) | | | | | |
|  | ↳ `light.downstairs_hallway_light_matter` — Downstairs Hallway Light Matter (`matter`) | | | | | |
|  | ↳ `number.downstairs_hallway_light_matter_on_level` — Downstairs Hallway Light Matter On Level (`matter`) | | | | | |
|  | ↳ `number.downstairs_hallway_light_matter_power_on_level` — Downstairs Hallway Light Matter Power-On Level (`matter`) | | | | | |
|  | ↳ `select.downstairs_hallway_light_matter_power_on_behavior` — Downstairs Hallway Light Matter Power-On Behavior (`matter`) | | | | | |
| [ ] | **Downstairs Hallway Presence** | Aqara / Soft Human Presence Sensor / 1 | `downstairs_hallway` | `d3f5a9feb53d491e04bbe119cee2071f` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.downstairs_hallway_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_10` — Identify (`matter`) | | | | | |
| [ ] | **Downstairs Hallway Presence** | Aqara / Soft Human Presence Sensor / 1 | `downstairs_hallway` | `977d89da95402eb2179e7ee8cb51b844` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_occupancy` — Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Entryway Presence** | Aqara / Soft Human Presence Sensor / 1 | `entryway` | `9d1c17f9083b8ba9d9e9f501ddcfc456` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.entryway_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_9` — Identify (`matter`) | | | | | |
| [ ] | **Entryway Presence** | Aqara / Soft Human Presence Sensor / 1 | `entryway` | `57aa55e603e292f3c307430cce9f9d1b` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.entryway_presence_occupancy` — Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Guest Bathroom Presence** | Aqara / Soft Human Presence Sensor / 1 | `guest_bathroom` | `b33b5d30cb1646ce968743092ddeb21a` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_bathroom_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_4` — Identify (`matter`) | | | | | |
| [ ] | **Guest Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `guest_room` | `9488a46ae0aee067720c918ef0c87ab5` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_room_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_5` — Identify (`matter`) | | | | | |
| [ ] | **Guest Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `guest_room` | `6125bef176334272377862e12ee76ff0` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.guest_room_presence_guest_room_soft_human_presence_occupancy` — Guest Room Soft Human Presence Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Hallway Presence** | Aqara / Soft Human Presence Sensor / 1 | `hallway` | `5f5d6dc0fa8f20c72bbc8db861302f33` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.hallway_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify` — Identify (`matter`) | | | | | |
| [ ] | **Kitchen Presence** | Aqara / Soft Human Presence Sensor / 1 | `kitchen` | `b4f023099d5441d75e534299e437e6e1` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.kitchen_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_8` — Identify (`matter`) | | | | | |
| [ ] | **Kitchen Presence** | Aqara / Soft Human Presence Sensor / 1 | `kitchen` | `df870912268264c2d7c2f6143bd9e50a` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.soft_human_presence_sensor_kitchen_presence_occupancy` — Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Living Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `living_room` | `d762e4a3b368f04312d9a06309a28443` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_6` — Identify (`matter`) | | | | | |
| [ ] | **Living Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `living_room` | `1da87adecda7d76571c7bd989723bdea` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.soft_human_presence_sensor_living_room_presence_occupancy` — Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Master Bedroom Bathroom Presence Sensor** | Aqara / Presence Multi-Sensor FP300 / 1.1.3.8 | `master_bedroom` | `534529103e48fa01b6edddff79374463` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_bathroom_presence_occupancy` — Master Bedroom Bathroom Occupancy (`matter`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_hardware_faults` — Hardware faults (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_identify_1` — Master Bedroom Bathroom Occupancy Identify (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_identify_2` — Master Bedroom Bathroom Illuminance Identify (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_identify_3` — Master Bedroom Bathroom Temperature Identify (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_identify_4` — Master Bedroom Bathroom Humidity Identify (`matter`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_hold_time` — Master Bedroom Bathroom Presence Hold Time (`matter`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensitivity` — Master Bedroom Bathroom Presence Sensitivity (`matter`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensitivity` — Master Bedroom Bathroom Presence Sensitivity (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_battery` — Master Bedroom Bathroom Battery (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_battery_type` — Master Bedroom Bathroom Battery Type (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_battery_voltage` — Master Bedroom Bathroom Battery Voltage (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_humidity` — Master Bedroom Bathroom Humidity (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_illuminance` — Master Bedroom Bathroom Illuminance (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_temperature` — Master Bedroom Bathroom Temperature (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_boot_reason` — Boot reason (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_reboot_count` — Reboot count (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_thread_channel` — Thread channel (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_thread_network_name` — Thread network name (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_thread_routing_role` — Thread routing role (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_uptime` — Uptime (`matter`) | | | | | |
|  | ↳ `update.master_bedroom_bathroom_presence_firmware` — Master Bedroom Bathroom Presence Firmware (`matter`) | | | | | |
| [ ] | **Master Bedroom Closet Light Matter** | Signify Netherlands B.V. / Hue ambiance downlight / 1.145.1 | `master_bedroom` | `3ea3825e65c49063cc14f61007829bd6` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bedroom_closet_light_identify` — Master Bedroom Closet Light Identify (`matter`) | | | | | |
|  | ↳ `light.master_bedroom_closet_light_matter` — Master Bedroom Closet Light Matter (`matter`) | | | | | |
|  | ↳ `number.master_bedroom_closet_light_on_level` — Master Bedroom Closet Light On Level (`matter`) | | | | | |
|  | ↳ `number.master_bedroom_closet_light_power_on_level` — Master Bedroom Closet Light Power-On Level (`matter`) | | | | | |
|  | ↳ `select.master_bedroom_closet_light_power_on_behavior_matter` — Master Bedroom Closet Light Power-On Behavior Matter (`matter`) | | | | | |
| [ ] | **Master Bedroom Closet Presence Sensor** | Aqara / Presence Multi-Sensor FP300 / 1.1.3.8 | `master_bedroom` | `6fc8fd598e175d7edea10c50d6c7af49` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_closet_presence_occupancy` — Master Bedroom Closet Occupancy (`matter`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_master_bedroom_closet_presence_sensor_hardware_faults` — Hardware faults (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_identify_1` — Master Bedroom Closet Occupancy Identify (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_identify_2` — Master Bedroom Closet Illuminance Identify (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_identify_3` — Master Bedroom Closet Temperature Identify (`matter`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_identify_4` — Master Bedroom Closet Humidity Identify (`matter`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_hold_time` — Master Bedroom Closet Presence Hold Time (`matter`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensitivity` — Master Bedroom Closet Presence Sensitivity (`matter`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensitivity` — Master Bedroom Closet Presence Sensitivity (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_battery` — Master Bedroom Closet Battery (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_battery_type` — Master Bedroom Closet Battery Type (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_battery_voltage` — Master Bedroom Closet Battery Voltage (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_humidity` — Master Bedroom Closet Humidity (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_illuminance` — Master Bedroom Closet Illuminance (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_temperature` — Master Bedroom Closet Temperature (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_boot_reason` — Boot reason (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_reboot_count` — Reboot count (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_thread_channel` — Thread channel (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_thread_network_name` — Thread network name (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_thread_routing_role` — Thread routing role (`matter`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_uptime` — Uptime (`matter`) | | | | | |
|  | ↳ `update.master_bedroom_closet_presence_firmware` — Master Bedroom Closet Presence Firmware (`matter`) | | | | | |
| [ ] | **Master Bedroom Presence** | Aqara / Soft Human Presence Sensor / 1 | `master_bedroom` | `5509e60cbb5744526f08185f5ae39331` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_2` — Identify (`matter`) | | | | | |
| [ ] | **Music Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `music_room` | `dd73ed87385a3e175a3a7cc459ab56cb` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.music_room_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_11` — Identify (`matter`) | | | | | |
| [ ] | **Music Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `music_room` | `d1c35d5b3294cf5aa94fde392dc9fd43` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.music_room_presence_occupancy` — Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Office Light** | Signify Netherlands B.V. / Hue ambiance downlight / 1.145.1 | `office` | `a02e57f9a1c4c7d1f6fcd0e20c8ccd71` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.office_light_matter_identify` — Office Light Matter Identify (`matter`) | | | | | |
|  | ↳ `light.office_light_matter` — Office Light Matter (`matter`) | | | | | |
|  | ↳ `number.office_light_matter_on_level` — Office Light Matter On Level (`matter`) | | | | | |
|  | ↳ `number.office_light_matter_power_on_level` — Office Light Matter Power-On Level (`matter`) | | | | | |
|  | ↳ `select.office_light_matter_power_on_behavior` — Office Light Matter Power-On Behavior (`matter`) | | | | | |
| [ ] | **Office Presence** | Aqara / Soft Human Presence Sensor / 1 | `office` | `4c145603752afecbb8313ce4db479dfd` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.office_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_3` — Identify (`matter`) | | | | | |
| [ ] | **Theater Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `theater_room` | `8255a16afa9e7d7b43facd344678c7fb` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.theater_room_soft_presence_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.soft_human_presence_sensor_identify_12` — Identify (`matter`) | | | | | |
| [ ] | **Theater Room Presence** | Aqara / Soft Human Presence Sensor / 1 | `theater_room` | `cd2d3cff0cc3cc3f5b6249644b900ad4` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.theater_room_presence_occupancy` — Occupancy (`real_last_changed`) | | | | | |
| [ ] | **Aqara Camera Hub G5 Pro** | Aqara / Aqara Camera Hub G5 Pro / 4.3.8 | `—` | `cfa5ca14cda3f9dd87f712ce9ca85ac1` | `—` | `—` |
|  | _No entities reported by the registry response._ | | | | | |
| [ ] | **Aqara Hub M3** | Aqara / Aqara Hub M3 / 4.5.50 | `—` | `23bc5f91d9d50ff89d467fff682607a9` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.aqara_hub_m3_identify` — Identify (`matter`) | | | | | |
|  | ↳ `sensor.aqara_hub_m3_boot_reason` — Boot reason (`matter`) | | | | | |
|  | ↳ `sensor.aqara_hub_m3_reboot_count` — Reboot count (`matter`) | | | | | |
|  | ↳ `sensor.aqara_hub_m3_uptime` — Uptime (`matter`) | | | | | |
|  | ↳ `sensor.aqara_hub_m3_wi_fi_rssi` — Wi-Fi RSSI (`matter`) | | | | | |
|  | ↳ `update.aqara_hub_m3_firmware` — Firmware (`matter`) | | | | | |
| [ ] | **Aqara Smart Lock U400** | Aqara / Aqara Smart Lock U400 / 3.1.1.0 | `—` | `93991fe791d2b847d8eb5f2d4d5c1d9f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.aqara_smart_lock_u400_actuator` — Actuator (`matter`) | | | | | |
|  | ↳ `button.aqara_smart_lock_u400_identify` — Identify (`matter`) | | | | | |
|  | ↳ `lock.aqara_smart_lock_u400` — — (`matter`) | | | | | |
|  | ↳ `number.aqara_smart_lock_u400_auto_relock_time` — Auto-relock time (`matter`) | | | | | |
|  | ↳ `number.aqara_smart_lock_u400_user_code_temporary_disable_time` — User code temporary disable time (`matter`) | | | | | |
|  | ↳ `number.aqara_smart_lock_u400_wrong_code_limit` — Wrong code limit (`matter`) | | | | | |
|  | ↳ `select.aqara_smart_lock_u400_operating_mode` — Operating mode (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_battery` — Battery (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_battery_charge_state` — Battery charge state (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_battery_voltage` — Battery voltage (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_reboot_count` — Reboot count (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_thread_channel` — Thread channel (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_thread_network_name` — Thread network name (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_thread_routing_role` — Thread routing role (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_lock_u400_uptime` — Uptime (`matter`) | | | | | |
|  | ↳ `update.aqara_smart_lock_u400_firmware` — Firmware (`matter`) | | | | | |
| [ ] | **Aqara Smart Video Doorbell G410** | Aqara / Aqara Smart Video Doorbell G410 / 4.5.20 | `—` | `c7772d06862701df0966b3cddbca3ba5` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.aqara_smart_video_doorbell_g410_identify` — Identify (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_video_doorbell_g410_reboot_count` — Reboot count (`matter`) | | | | | |
|  | ↳ `sensor.aqara_smart_video_doorbell_g410_uptime` — Uptime (`matter`) | | | | | |
| [ ] | **Christmas Lights** | Signify Netherlands B.V. / Festavia string lights / 1.122.8 | `—` | `0638ae82c5797d2f6d0faf8c67fc944b` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.christmas_lights_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.christmas_lights_2` — — (`matter`) | | | | | |
|  | ↳ `number.christmas_lights_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.christmas_lights_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.christmas_lights_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Doorbell Ring** | Aqara / Doorbell Ring / 1 | `—` | `5dea7da8c401d4ee4045e181e6966282` | `23bc5f91d9d50ff89d467fff682607a9` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.doorbell_ring_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.doorbell_ring_identify` — Identify (`matter`) | | | | | |
| [ ] | **Downstairs Hallway Light** | Signify Netherlands B.V. / Hue ambiance downlight / 1.145.1 | `—` | `4c17e8bf011666d1066cb2c0cf6a5e0b` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hue_ambiance_downlight_1_identify` — Identify (`matter`) | | | | | |
|  | ↳ `light.hue_ambiance_downlight_1_2` — — (`matter`) | | | | | |
|  | ↳ `number.hue_ambiance_downlight_1_on_level` — On level (`matter`) | | | | | |
|  | ↳ `number.hue_ambiance_downlight_1_power_on_level` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.hue_ambiance_downlight_1_power_on_behavior` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Hue Bridge Pro** | Signify / BSB003 / 1.4.2 | `—` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.hue_bridge_pro_reboot_count` — Reboot count (`matter`) | | | | | |
|  | ↳ `sensor.hue_bridge_pro_uptime` — Uptime (`matter`) | | | | | |
| [ ] | **Music Room Bathroom Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `7a0044be4aa769cac67a21d7c83da1ca` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_bathroom_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_bathroom_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_bathroom_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_bathroom_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_bathroom_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Couch Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `8a6d67f5b32158aa21e13a5e7beeb62a` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_couch_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_couch_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_couch_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_couch_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_couch_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Door Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `74e3a9e1cc065f63d8d47920a228b13f` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hue_color_downlight_1_identify` — Identify (`matter`) | | | | | |
|  | ↳ `light.hue_color_downlight_1_2` — — (`matter`) | | | | | |
|  | ↳ `number.hue_color_downlight_1_on_level` — On level (`matter`) | | | | | |
|  | ↳ `number.hue_color_downlight_1_power_on_level` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.hue_color_downlight_1_power_on_behavior` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Drums Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `69261c7aa3eeb76ff8fcd28244cf4e7c` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_drums_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_drums_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_drums_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_drums_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_drums_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Entry Light** | Signify Netherlands B.V. / Hue color downlight / 1.145.1 | `—` | `9f35cd54102f7b1bfa2f23b0652262d6` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_entry_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_entry_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_entry_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_entry_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_entry_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Fireplace Light** | Signify Netherlands B.V. / Hue color downlight / 1.145.1 | `—` | `0b1d2969ee12844e85d5b4ecb4661c0a` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_fireplace_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_fireplace_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_fireplace_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_fireplace_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_fireplace_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Fireplace Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `9b34d58cd728f72c11150e52db42f66d` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hue_color_downlight_1_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.hue_color_downlight_1_4` — — (`matter`) | | | | | |
|  | ↳ `number.hue_color_downlight_1_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.hue_color_downlight_1_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.hue_color_downlight_1_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Hue Play Left** | Signify Netherlands B.V. / Hue Play / 1.163.2 | `—` | `c82f1bf544927b4d7efafb1fee37390e` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_hue_play_left_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_hue_play_left_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_hue_play_left_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_hue_play_left_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_hue_play_left_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Hue Play Right** | Signify Netherlands B.V. / Hue Play / 1.163.2 | `—` | `65f409a072d92d704479afb3f812dc5d` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_hue_play_right_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_hue_play_right_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_hue_play_right_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_hue_play_right_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_hue_play_right_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Server Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `8d3839476aefdcdbaf38a56d75cd7c07` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_server_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_server_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_server_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_server_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_server_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room TV Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `402341369b6a04ff227f68badda4e7f9` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_tv_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_tv_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_tv_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_tv_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_tv_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Music Room Window Light** | Signify Netherlands B.V. / Hue color downlight / 1.163.1 | `—` | `3d9fdc6f57cada3124a1643a09356bbf` | `c1381d1100b1aee4f61ed824106d1c2e` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.music_room_window_light_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `light.music_room_window_light_2` — — (`matter`) | | | | | |
|  | ↳ `number.music_room_window_light_on_level_2` — On level (`matter`) | | | | | |
|  | ↳ `number.music_room_window_light_power_on_level_2` — Power-on level (`matter`) | | | | | |
|  | ↳ `select.music_room_window_light_power_on_behavior_2` — Power-on behavior (`matter`) | | | | | |
| [ ] | **Thermostat Hub W200** | Aqara / Thermostat Hub W200 / 4.5.49 | `—` | `a388c190f155fc8f0031541219f6388f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.thermostat_hub_w200_occupancy` — Occupancy (`matter`) | | | | | |
|  | ↳ `button.thermostat_hub_w200_identify` — Identify (`matter`) | | | | | |
|  | ↳ `button.thermostat_hub_w200_identify_2` — Identify (`matter`) | | | | | |
|  | ↳ `button.thermostat_hub_w200_identify_3` — Identify (`matter`) | | | | | |
|  | ↳ `climate.thermostat_hub_w200` — — (`matter`) | | | | | |
|  | ↳ `number.thermostat_hub_w200_hold_time` — Hold time (`matter`) | | | | | |
|  | ↳ `number.thermostat_hub_w200_sensitivity` — Sensitivity (`matter`) | | | | | |
|  | ↳ `sensor.thermostat_hub_w200_humidity` — Humidity (`matter`) | | | | | |
|  | ↳ `sensor.thermostat_hub_w200_reboot_count` — Reboot count (`matter`) | | | | | |
|  | ↳ `sensor.thermostat_hub_w200_temperature` — Temperature (`matter`) | | | | | |
|  | ↳ `sensor.thermostat_hub_w200_uptime` — Uptime (`matter`) | | | | | |
|  | ↳ `sensor.thermostat_hub_w200_wi_fi_rssi` — Wi-Fi RSSI (`matter`) | | | | | |
|  | ↳ `update.thermostat_hub_w200_firmware` — Firmware (`matter`) | | | | | |
| [ ] | **Thermostat Hub W200** | Aqara / Thermostat Hub W200 / 4.5.49 | `—` | `8aaa5286faff911c86ed549e8986d00b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.thermostat_hub_w200_occupancy` — Occupancy (`real_last_changed`) | | | | | |

### `met` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Forecast** | Met.no / Forecast | `—` | `8f25bf38fa2a45cd0bb7c27a5ba6fd73` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `weather.forecast_home` — Home (`met`) | | | | | |

### `mobile_app` (4 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Galaxy Z Fold 8 Emulator** | Google / sdk_gphone64_x86_64 / 37 | `—` | `90ac289c63a75f8efaf57d6b1b1eb809` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_android_auto` — Android Auto (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_app_inactive` — App inactive (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_bluetooth_state` — Bluetooth state (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_device_locked` — Device locked (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_device_secure` — Device secure (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_doze_mode` — Doze mode (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_headphones` — Headphones (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_hotspot_state` — Hotspot state (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_interactive` — Interactive (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_is_charging` — Is charging (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_keyguard_locked` — Keyguard locked (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_keyguard_secure` — Keyguard secure (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_mic_muted` — Mic muted (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_mobile_data` — Mobile data (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_mobile_data_roaming` — Mobile data roaming (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_music_active` — Music active (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_power_save` — Power save (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_speakerphone` — Speakerphone (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_wi_fi_state` — Wi-Fi state (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.galaxy_z_fold_8_emulator_work_profile` — Work profile (`mobile_app`) | | | | | |
|  | ↳ `device_tracker.galaxy_z_fold_8_emulator` — — (`mobile_app`) | | | | | |
|  | ↳ `notify.galaxy_z_fold_8_emulator` — — (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_accent_color` — Accent color (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_active_calories_burned` — Active calories burned (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_app_importance` — App importance (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_app_memory` — App memory (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_app_rx_gb` — App Rx GB (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_app_standby_bucket` — App standby bucket (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_app_tx_gb` — App Tx GB (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_audio_mode` — Audio mode (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_basal_body_temperature` — Basal body temperature (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_basal_metabolic_rate` — Basal metabolic rate (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_battery_cycle_count` — Battery cycle count (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_battery_health` — Battery health (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_battery_level` — Battery level (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_battery_power` — Battery power (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_battery_state` — Battery state (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_battery_temperature` — Battery temperature (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_beacon_monitor` — Beacon monitor (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_ble_transmitter` — BLE transmitter (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_blood_glucose` — Blood glucose (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_bluetooth_connection` — Bluetooth connection (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_body_fat` — Body fat (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_body_temperature` — Body temperature (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_body_water_mass` — Body water mass (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_bone_mass` — Bone mass (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_battery` — Car battery (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_charging_status` — Car charging status (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_ev_connector_type` — Car EV connector type (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_fuel` — Car fuel (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_fuel_type` — Car fuel type (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_name` — Car name (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_odometer` — Car odometer (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_range_remaining` — Car range remaining (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_car_speed` — Car speed (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_charger_type` — Charger type (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_current_time_zone` — Current time zone (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_current_version` — Current version (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_daily_distance` — Daily distance (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_daily_elevation_gained` — Daily elevation gained (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_daily_floors` — Daily floors (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_daily_hydration` — Daily hydration (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_daily_steps` — Daily steps (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_data_network_type_sim_1` — Data network type (SIM 1) (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_data_network_type_sim_2` — Data network type (SIM 2) (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_detected_activity` — Detected activity (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_diastolic_blood_pressure` — Diastolic blood pressure (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_do_not_disturb_sensor` — Do Not Disturb sensor (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_external_storage` — External storage (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_geocoded_location` — Geocoded location (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_heart_rate` — Heart rate (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_heart_rate_variability` — Heart rate variability (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_height` — Height (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_internal_storage` — Internal storage (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_ipv6_addresses` — IPv6 addresses (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_last_reboot` — Last reboot (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_last_used_app` — Last used app (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_lean_body_mass` — Lean body mass (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_light_sensor` — Light sensor (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_media_session` — Media session (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_mobile_rx_gb` — Mobile Rx GB (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_mobile_tx_gb` — Mobile Tx GB (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_network_type` — Network type (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_next_alarm` — Next alarm (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_os_version` — OS version (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_oxygen_saturation` — Oxygen saturation (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_phone_state` — Phone state (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_pressure_sensor` — Pressure sensor (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_proximity_sensor` — Proximity sensor (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_public_ip_address` — Public IP address (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_remaining_charge_time` — Remaining charge time (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_respiratory_rate` — Respiratory rate (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_resting_heart_rate` — Resting heart rate (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_ringer_mode` — Ringer mode (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_screen_brightness` — Screen brightness (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_screen_off_timeout` — Screen off timeout (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_screen_orientation` — Screen orientation (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_screen_rotation` — Screen rotation (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_security_patch` — Security patch (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_signal_strength_sim_1` — Signal strength (SIM 1) (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_signal_strength_sim_2` — Signal strength (SIM 2) (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_sim_1` — SIM 1 (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_sim_2` — SIM 2 (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_sleep_confidence` — Sleep confidence (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_sleep_duration` — Sleep duration (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_sleep_segment` — Sleep segment (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_systolic_blood_pressure` — Systolic blood pressure (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_total_calories_burned` — Total calories burned (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_total_rx_gb` — Total Rx GB (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_total_tx_gb` — Total Tx GB (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_vo2_max` — VO2 max (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_accessibility` — Volume level accessibility (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_alarm` — Volume level alarm (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_call` — Volume level call (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_dtmf` — Volume level DTMF (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_music` — Volume level music (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_notification` — Volume level notification (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_ringer` — Volume level ringer (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_volume_level_system` — Volume level system (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_weight` — Weight (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_wi_fi_bssid` — Wi-Fi BSSID (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_wi_fi_connection` — Wi-Fi connection (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_wi_fi_frequency` — Wi-Fi frequency (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_wi_fi_ip_address` — Wi-Fi IP address (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_wi_fi_link_speed` — Wi-Fi link speed (`mobile_app`) | | | | | |
|  | ↳ `sensor.galaxy_z_fold_8_emulator_wi_fi_signal_strength` — Wi-Fi signal strength (`mobile_app`) | | | | | |
| [ ] | **Stephanie’s iPhone** | Apple / iPhone13,3 / 26.3.1 | `—` | `c9e6b39b126fcbe03c3a4d9c97eb4d97` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `device_tracker.stephanies_iphone` — — (`mobile_app`) | | | | | |
|  | ↳ `notify.stephanies_iphone` — — (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_app_version` — App Version (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_audio_output` — Audio Output (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_battery_level` — Battery Level (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_battery_state` — Battery State (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_bssid` — BSSID (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_connection_type` — Connection Type (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_geocoded_location` — Geocoded Location (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_last_update_trigger` — Last Update Trigger (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_location_permission` — Location permission (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_sim_1` — SIM 1 (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_sim_2` — SIM 2 (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_ssid` — SSID (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_storage` — Storage (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_watch_battery_level` — Watch Battery Level (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephanies_iphone_watch_battery_state` — Watch Battery State (`mobile_app`) | | | | | |
| [ ] | **Stephen's iPhone** | Apple / iPhone18,1 / 27.0 | `—` | `d41304910563e1c780b980a478f469ad` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.iphone_13_pro_6_focus` — iPhone 13 Pro (6) Focus (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.stephen_s_iphone_iphone_13_pro_6_camera_motion` — iPhone 13 Pro (6) Camera Motion (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.stephen_s_iphone_iphone_13_pro_6_kiosk_mode` — iPhone 13 Pro (6) Kiosk Mode (`mobile_app`) | | | | | |
|  | ↳ `binary_sensor.stephen_s_iphone_iphone_13_pro_6_kiosk_screensaver` — iPhone 13 Pro (6) Kiosk Screensaver (`mobile_app`) | | | | | |
|  | ↳ `device_tracker.iphone_17_pro` — iPhone 13 Pro (6) (`mobile_app`) | | | | | |
|  | ↳ `notify.stephen_s_iphone` — — (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_app_version` — iPhone 13 Pro (6) App Version (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_audio_output` — iPhone 13 Pro (6) Audio Output (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_battery_level` — iPhone 13 Pro (6) Battery Level (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_battery_state` — iPhone 13 Pro (6) Battery State (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_bssid` — iPhone 13 Pro (6) BSSID (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_connection_type` — iPhone 13 Pro (6) Connection Type (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_geocoded_location` — iPhone 13 Pro (6) Geocoded Location (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_last_update_trigger` — iPhone 13 Pro (6) Last Update Trigger (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_location_permission` — iPhone 13 Pro (6) Location permission (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_sim_1` — iPhone 13 Pro (6) SIM 1 (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_sim_2` — iPhone 13 Pro (6) SIM 2 (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_ssid` — iPhone 13 Pro (6) SSID (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_storage` — iPhone 13 Pro (6) Storage (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_watch_battery_level` — iPhone 13 Pro (6) Watch Battery Level (`mobile_app`) | | | | | |
|  | ↳ `sensor.iphone_13_pro_6_watch_battery_state` — iPhone 13 Pro (6) Watch Battery State (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephen_s_iphone_iphone_13_pro_6_camera_stream` — iPhone 13 Pro (6) Camera Stream (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephen_s_iphone_iphone_13_pro_6_kiosk_brightness` — iPhone 13 Pro (6) Kiosk Brightness (`mobile_app`) | | | | | |
|  | ↳ `sensor.stephen_s_iphone_iphone_13_pro_6_kiosk_volume` — iPhone 13 Pro (6) Kiosk Volume (`mobile_app`) | | | | | |
| [ ] | **iPad** | Apple / iPad16,5 / 27.0 | `—` | `93dd238730f66958fcebc6271410b7c9` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `device_tracker.ipad` — — (`mobile_app`) | | | | | |
|  | ↳ `notify.ipad` — — (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_app_version` — App Version (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_audio_output` — Audio Output (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_battery_level` — Battery Level (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_battery_state` — Battery State (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_bssid` — BSSID (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_connection_type` — Connection Type (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_geocoded_location` — Geocoded Location (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_last_update_trigger` — Last Update Trigger (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_location_permission` — Location permission (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_ssid` — SSID (`mobile_app`) | | | | | |
|  | ↳ `sensor.ipad_storage` — Storage (`mobile_app`) | | | | | |

### `mqtt` (15 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Eight Sleep Pod 5** | Free Sleep / Pod 4 / 2.1.15 | `master_bedroom` | `082160d6776b6078a0dbee6797c12a13` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.nightcanvasrestful_left_alarm_vibrating` — Stephen's Bed Alarm Vibrating (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.nightcanvasrestful_left_presence` — Stephen's Bed Presence (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.nightcanvasrestful_priming` — Pod 5 Priming (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.nightcanvasrestful_right_alarm_vibrating` — Steph's Bed Alarm Vibrating (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.nightcanvasrestful_right_presence` — Steph's Bed Presence (`mqtt`) | | | | | |
|  | ↳ `button.nightcanvasrestful_clear_alarm` — Pod 5 Clear Alarm (`mqtt`) | | | | | |
|  | ↳ `button.nightcanvasrestful_prime_pod` — Pod 5 Prime Pod (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_led_brightness` — Pod 5 LED Brightness (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_left_asleep_temperature` — Stephen's Asleep Level (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_left_bedtime_temperature` — Stephen's Bedtime Level (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_left_dawn_temperature` — Stephen's Dawn Level (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_left_target_temperature` — Stephen's Bed Target Level (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_right_asleep_temperature` — Steph's Asleep Level (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_right_bedtime_temperature` — Steph's Bedtime Level (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_right_dawn_temperature` — Steph's Dawn Level (`mqtt`) | | | | | |
|  | ↳ `number.nightcanvasrestful_right_target_temperature` — Steph's Bed Target Level (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_breathing_rate` — Stephen's Bed Breathing Rate (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_current_temperature` — Stephen's Bed Current Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_heart_rate` — Stephen's Bed Heart Rate (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_hrv` — Stephen's Bed HRV (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_movement` — Stephen's Bed Movement (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_next_alarm` — Stephen's Bed Next Alarm (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_next_power_off` — Stephen's Bed Next Power Off (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_next_power_on` — Stephen's Bed Next Power On (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_next_temperature_adjustment` — Stephen's Bed Next Temperature Adjustment (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_left_seconds_remaining` — Stephen's Bed Time Remaining (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_breathing_rate` — Steph's Bed Breathing Rate (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_current_temperature` — Steph's Bed Current Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_heart_rate` — Steph's Bed Heart Rate (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_hrv` — Steph's Bed HRV (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_movement` — Steph's Bed Movement (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_next_alarm` — Steph's Bed Next Alarm (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_next_power_off` — Steph's Bed Next Power Off (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_next_power_on` — Steph's Bed Next Power On (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_next_temperature_adjustment` — Steph's Bed Next Temperature Adjustment (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_right_seconds_remaining` — Steph's Bed Time Remaining (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_schedules` — Free Sleep Schedules (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_water_level` — Pod 5 Water Level (`mqtt`) | | | | | |
|  | ↳ `sensor.nightcanvasrestful_wifi_strength` — Pod 5 Wi-Fi Strength (`mqtt`) | | | | | |
|  | ↳ `switch.nightcanvasrestful_left_alarms_enabled` — Stephen's Bed Alarms Enabled (`mqtt`) | | | | | |
|  | ↳ `switch.nightcanvasrestful_left_away_mode` — Stephen's Bed Away Mode (`mqtt`) | | | | | |
|  | ↳ `switch.nightcanvasrestful_left_power` — Stephen's Bed Power (`mqtt`) | | | | | |
|  | ↳ `switch.nightcanvasrestful_right_alarms_enabled` — Steph's Bed Alarms Enabled (`mqtt`) | | | | | |
|  | ↳ `switch.nightcanvasrestful_right_away_mode` — Steph's Bed Away Mode (`mqtt`) | | | | | |
|  | ↳ `switch.nightcanvasrestful_right_power` — Steph's Bed Power (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_eight_sleep_pod_5_left_bedtime` — Left Bedtime (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_eight_sleep_pod_5_right_bedtime` — Right Bedtime (`mqtt`) | | | | | |
| [ ] | **SleepyPod Eight Pod** | Sleepypod / Pod | `master_bedroom` | `7714937c70f522b7e72244c6502af771` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_sleepypod_eight_pod_left_bed_occupancy` — Left bed occupancy (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_sleepypod_eight_pod_right_bed_occupancy` — Right bed occupancy (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.sleepypod_eight_pod_left_pump_clog_detected` — Left pump clog detected (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.sleepypod_eight_pod_left_pump_stall` — Left pump stall (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.sleepypod_eight_pod_right_pump_clog_detected` — Right pump clog detected (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.sleepypod_eight_pod_right_pump_stall` — Right pump stall (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_sleepypod_eight_pod_left_alarm_snooze` — Left alarm snooze (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_sleepypod_eight_pod_left_alarm_stop` — Left alarm stop (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze` — Right alarm snooze (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_sleepypod_eight_pod_right_alarm_stop` — Right alarm stop (`mqtt`) | | | | | |
|  | ↳ `climate.sleepypod_eight_pod_left_side` — Stephen's SleepyPod (`mqtt`) | | | | | |
|  | ↳ `climate.sleepypod_eight_pod_right_side` — Steph's SleepyPod (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_sleepypod_eight_pod_left_target_level` — Left target level (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_sleepypod_eight_pod_right_target_level` — Right target level (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_sleepypod_eight_pod_button_gestures` — Button gestures (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state` — Left alarm state (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state` — Right alarm state (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_sleepypod_eight_pod_schedules` — Schedules (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_ambient_humidity` — Ambient humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_ambient_temperature` — Ambient temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_left_breathing_rate` — Left breathing rate (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_left_heart_rate` — Left heart rate (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_left_hrv` — Left HRV (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_left_pump_loop_temp` — Left pump loop temp (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_left_pump_rpm` — Left pump RPM (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_right_breathing_rate` — Right breathing rate (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_right_heart_rate` — Right heart rate (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_right_hrv` — Right HRV (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_right_pump_loop_temp` — Right pump loop temp (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_right_pump_rpm` — Right pump RPM (`mqtt`) | | | | | |
|  | ↳ `sensor.sleepypod_eight_pod_water_level` — Water level (`mqtt`) | | | | | |
| [ ] | **Music Room Robot Vacuum** | Valetudo / Dreame X40 Ultra / 2026.08.0 | `music_room` | `7286f6d5bfd6237308a851022a97cc3f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.valetudo_elatedusedram_mop_attachment` — Mop Attachment (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_elatedusedram_play_locate_sound` — Play locate sound (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_elatedusedram_reset_main_brush_consumable` — Reset Main Brush Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_elatedusedram_reset_main_filter_consumable` — Reset Main Filter Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_elatedusedram_reset_right_brush_consumable` — Reset Right Brush Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_elatedusedram_reset_sensor_cleaning_consumable` — Reset Sensor Cleaning Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_elatedusedram_reset_wheel_cleaning_consumable` — Reset Wheel Cleaning Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_elatedusedram_trigger_auto_empty_dock` — Trigger Auto Empty Dock (`mqtt`) | | | | | |
|  | ↳ `camera.valetudo_elatedusedram_map_data` — Map data (`mqtt`) | | | | | |
|  | ↳ `number.valetudo_elatedusedram_speaker_volume` — Speaker volume (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_elatedusedram_carpet_sensor_mode` — Carpet Sensor Mode (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_elatedusedram_fan` — Fan (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_elatedusedram_mode` — Mode (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_elatedusedram_water` — Water (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_battery_level` — Battery level (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_current_statistics_area` — Current Statistics Area (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_current_statistics_time` — Current Statistics Time (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_detergent_dock_component` — Detergent Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_dock_status` — Dock Status (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_dustbag_dock_component` — Dustbag Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_error` — Error (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_events` — Events (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_freshwater_dock_component` — Freshwater Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_main_brush` — Main Brush (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_main_filter` — Main Filter (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_map_segments` — Map segments (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_right_brush` — Right Brush (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_sensor_cleaning` — Sensor Cleaning (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_status_flag` — Status Flag (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_total_statistics_area` — Total Statistics Area (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_total_statistics_count` — Total Statistics Count (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_total_statistics_time` — Total Statistics Time (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_wastewater_dock_component` — Wastewater Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_wheel_cleaning` — Wheel Cleaning (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_elatedusedram_wi_fi_configuration` — Wi-Fi configuration (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_elatedusedram_carpet_mode` — Carpet Mode (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_elatedusedram_lock_keys` — Lock Keys (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_elatedusedram_obstacle_avoidance` — Obstacle Avoidance (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_elatedusedram_pet_obstacle_avoidance` — Pet Obstacle Avoidance (`mqtt`) | | | | | |
|  | ↳ `vacuum.valetudo_elatedusedram` — Robot (`mqtt`) | | | | | |
| [ ] | **Music Room Robot Vacuum** | Valetudo / Dreame X40 Ultra / 2026.08.0 | `music_room` | `89d261259d5a3a0e6b662ef4e4c4c5ac` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.music_room_music_room_robot_vacuum_estimated_segment` — Estimated Segment (`valetudo`) | | | | | |
|  | ↳ `sensor.music_room_robot_vacuum_estimated_segment` — Estimated Segment (`valetudo`) | | | | | |
| [ ] | **DESKTOP-EKMU9C4-satellite** | HASS.Agent Team / Microsoft Windows NT 10.0.19045.0 / 2.2.0.0 | `—` | `192573ec9df335fe446b3e96ecdcee92` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.desktop_ekmu9c4_satellite_custom` — Shutdown Theater Room PC (`mqtt`) | | | | | |
| [ ] | **Main Floor Robot Vacuum** | Valetudo / Dreame X40 Ultra / 2026.08.0 | `—` | `d70a99501fcb015d9e6f0eb795ff1832` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.valetudo_exaltedsneakydeer_mop_attachment` — Mop Attachment (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_exaltedsneakydeer_play_locate_sound` — Play locate sound (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_exaltedsneakydeer_reset_main_brush_consumable` — Reset Main Brush Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_exaltedsneakydeer_reset_main_filter_consumable` — Reset Main Filter Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_exaltedsneakydeer_reset_right_brush_consumable` — Reset Right Brush Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_exaltedsneakydeer_reset_sensor_cleaning_consumable` — Reset Sensor Cleaning Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_exaltedsneakydeer_reset_wheel_cleaning_consumable` — Reset Wheel Cleaning Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock` — Trigger Auto Empty Dock (`mqtt`) | | | | | |
|  | ↳ `camera.valetudo_exaltedsneakydeer_map_data` — Map data (`mqtt`) | | | | | |
|  | ↳ `number.valetudo_exaltedsneakydeer_speaker_volume` — Speaker volume (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_exaltedsneakydeer_carpet_sensor_mode` — Carpet Sensor Mode (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_exaltedsneakydeer_fan` — Fan (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_exaltedsneakydeer_mode` — Mode (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_exaltedsneakydeer_water` — Water (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_battery_level` — Battery level (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_current_statistics_area` — Current Statistics Area (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_current_statistics_time` — Current Statistics Time (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_detergent_dock_component` — Detergent Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_dock_status` — Dock Status (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_dustbag_dock_component` — Dustbag Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_error` — Error (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_events` — Events (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_freshwater_dock_component` — Freshwater Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_main_brush` — Main Brush (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_main_filter` — Main Filter (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_map_segments` — Map segments (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_right_brush` — Right Brush (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_sensor_cleaning` — Sensor Cleaning (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_status_flag` — Status Flag (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_total_statistics_area` — Total Statistics Area (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_total_statistics_count` — Total Statistics Count (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_total_statistics_time` — Total Statistics Time (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_wastewater_dock_component` — Wastewater Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_wheel_cleaning` — Wheel Cleaning (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_exaltedsneakydeer_wi_fi_configuration` — Wi-Fi configuration (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_exaltedsneakydeer_carpet_mode` — Carpet Mode (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_exaltedsneakydeer_lock_keys` — Lock Keys (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_exaltedsneakydeer_obstacle_avoidance` — Obstacle Avoidance (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_exaltedsneakydeer_pet_obstacle_avoidance` — Pet Obstacle Avoidance (`mqtt`) | | | | | |
|  | ↳ `vacuum.valetudo_exaltedsneakydeer` — Robot (`mqtt`) | | | | | |
| [ ] | **Main Floor Robot Vacuum** | Valetudo / Dreame X40 Ultra / 2026.08.0 | `—` | `e4887acc9c3df4c12e447934cf62b651` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.main_floor_robot_vacuum_estimated_segment` — Estimated Segment (`valetudo`) | | | | | |
|  | ↳ `sensor.valetudo_x40_ultra_exaltedsneakydeer_estimated_segment` — Estimated Segment (`valetudo`) | | | | | |
| [ ] | **OFFICE-PC-satellite** | HASS.Agent Team / Microsoft Windows NT 10.0.26200.0 / 2.2.1.0 | `—` | `b451771475e2b0b17aeae43f678311a3` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.office_pc_satellite_steph_pc_shutdown_satellite` — Steph PC Shutdown (`mqtt`) | | | | | |
| [ ] | **SFENTON-MUSIC-satellite** | HASS.Agent Team / Microsoft Windows NT 10.0.26200.0 / 2.2.0.0 | `—` | `27284f4f47b60078c3f985b37be04ab7` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.sfenton_music_satellite_music_room_pc_turn_off` — Music Room PC Turn Off (`mqtt`) | | | | | |
| [ ] | **SFENTON-PRIMARY** | HASS.Agent Team / Microsoft Windows NT 10.0.26220.0 / 2.2.1 | `—` | `c823ac30f2c222a84e64cee2aae3767b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.sfenton_primary_shudown_stephens_pc_immediately` — Shutdown Stephen's PC Immediately (`mqtt`) | | | | | |
|  | ↳ `sensor.sfenton_primary_stephens_pc_last_system_change` — Stephen's PC Last System State Change (`mqtt`) | | | | | |
| [ ] | **SFENTON-PRIMARY-satellite** | HASS.Agent Team / Microsoft Windows NT 10.0.26220.0 / 2.2.1.0 | `—` | `2eebaa8e2ec1eb287e8e9f76c66906da` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.sfenton_primary_satellite_shutdown_stephens_pc_satellite` — Shutdown Stephen's PC (Satellite Service) (`mqtt`) | | | | | |
| [ ] | **Steph_sPC** | HASS.Agent Team / Microsoft Windows NT 10.0.26200.0 / 2.2.1 | `—` | `df15830eb82b68afa0578591f1be9bc7` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.steph_spc_stephpc_lastsystemstatechange` — Steph's PC Last System State Change (`mqtt`) | | | | | |
| [ ] | **Theater Room Vacuum** | Valetudo / Dreame X40 Ultra / 2026.08.0 | `—` | `1812069fab876f374ad018292cb65ceb` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.valetudo_politefatherlykingfisher_mop_attachment` — Mop Attachment (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_politefatherlykingfisher_play_locate_sound` — Play locate sound (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_politefatherlykingfisher_reset_main_brush_consumable` — Reset Main Brush Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_politefatherlykingfisher_reset_main_filter_consumable` — Reset Main Filter Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_politefatherlykingfisher_reset_right_brush_consumable` — Reset Right Brush Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_politefatherlykingfisher_reset_sensor_cleaning_consumable` — Reset Sensor Cleaning Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_politefatherlykingfisher_reset_wheel_cleaning_consumable` — Reset Wheel Cleaning Consumable (`mqtt`) | | | | | |
|  | ↳ `button.valetudo_politefatherlykingfisher_trigger_auto_empty_dock` — Trigger Auto Empty Dock (`mqtt`) | | | | | |
|  | ↳ `camera.valetudo_politefatherlykingfisher_map_data` — Map data (`mqtt`) | | | | | |
|  | ↳ `number.valetudo_politefatherlykingfisher_speaker_volume` — Speaker volume (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_politefatherlykingfisher_carpet_sensor_mode` — Carpet Sensor Mode (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_politefatherlykingfisher_fan` — Fan (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_politefatherlykingfisher_mode` — Mode (`mqtt`) | | | | | |
|  | ↳ `select.valetudo_politefatherlykingfisher_water` — Water (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_battery_level` — Battery level (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_current_statistics_area` — Current Statistics Area (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_current_statistics_time` — Current Statistics Time (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_detergent_dock_component` — Detergent Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_dock_status` — Dock Status (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_dustbag_dock_component` — Dustbag Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_error` — Error (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_events` — Events (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_freshwater_dock_component` — Freshwater Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_main_brush` — Main Brush (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_main_filter` — Main Filter (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_map_segments` — Map segments (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_right_brush` — Right Brush (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_sensor_cleaning` — Sensor Cleaning (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_status_flag` — Status Flag (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_total_statistics_area` — Total Statistics Area (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_total_statistics_count` — Total Statistics Count (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_total_statistics_time` — Total Statistics Time (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_wastewater_dock_component` — Wastewater Dock Component (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_wheel_cleaning` — Wheel Cleaning (`mqtt`) | | | | | |
|  | ↳ `sensor.valetudo_politefatherlykingfisher_wi_fi_configuration` — Wi-Fi configuration (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_politefatherlykingfisher_carpet_mode` — Carpet Mode (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_politefatherlykingfisher_lock_keys` — Lock Keys (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_politefatherlykingfisher_obstacle_avoidance` — Obstacle Avoidance (`mqtt`) | | | | | |
|  | ↳ `switch.valetudo_politefatherlykingfisher_pet_obstacle_avoidance` — Pet Obstacle Avoidance (`mqtt`) | | | | | |
|  | ↳ `vacuum.valetudo_politefatherlykingfisher` — Robot (`mqtt`) | | | | | |
| [ ] | **Theater Room Vacuum** | Valetudo / Dreame X40 Ultra / 2026.05.0 | `—` | `d9ab3d76a6e7753f650dfc894c8e832b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.theater_room_vacuum_estimated_segment` — Estimated Segment (`valetudo`) | | | | | |
|  | ↳ `sensor.theater_room_vacuum_estimated_segment_2` — Estimated Segment (`valetudo`) | | | | | |
| [ ] | **Transit Tracker 2783a0** | — | `—` | `88af05f396409573262cd0d6ae0f5e81` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `light.transit_tracker_2783a0_divider_color` — Pinned Line Color (`mqtt`) | | | | | |
|  | ↳ `light.transit_tracker_2783a0_route_color_st_1_102548` — B Line Color (`mqtt`) | | | | | |
|  | ↳ `light.transit_tracker_2783a0_route_color_st_40_100236` — 545 Color (`mqtt`) | | | | | |
|  | ↳ `light.transit_tracker_2783a0_route_color_st_40_100511` — 542 Color (`mqtt`) | | | | | |
|  | ↳ `light.transit_tracker_2783a0_route_color_st_40_2line` — 2 Line Color (`mqtt`) | | | | | |
|  | ↳ `select.transit_tracker_2783a0_route_st_1_102548_bellevue_transit_center_crossroads_st_1_73130` — B Line - Bellevue Transit Center Crossroads - 148th Ave NE & NE Old Redmond Rd (`mqtt`) | | | | | |
|  | ↳ `select.transit_tracker_2783a0_route_st_1_102548_downtown_redmond_station_st_1_73391` — B Line - Downtown Redmond Station - 148th Ave NE & NE Old Redmond Rd (`mqtt`) | | | | | |
|  | ↳ `select.transit_tracker_2783a0_route_st_40_100236_downtown_seattle_st_1_71341` — 545 - Downtown Seattle - Sr 520 & NE 51st St (`mqtt`) | | | | | |
|  | ↳ `select.transit_tracker_2783a0_route_st_40_100511_u_district_station_st_1_71341` — 542 - U-District Station - Sr 520 & NE 51st St (`mqtt`) | | | | | |
|  | ↳ `select.transit_tracker_2783a0_route_st_40_2line_south_bellevue_st_40_e27_t1` — 2 Line - South Bellevue - Redmond Technology (`mqtt`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_route_st_1_102548_bellevue_transit_center_crossroads_st_1_73130_next_only` — B Line - Bellevue Transit Center Crossroads - 148th Ave NE & NE Old Redmond Rd Only Next Trip (`mqtt`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_route_st_1_102548_downtown_redmond_station_st_1_73391_next_only` — B Line - Downtown Redmond Station - 148th Ave NE & NE Old Redmond Rd Only Next Trip (`mqtt`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_route_st_40_100236_downtown_seattle_st_1_71341_next_only` — 545 - Downtown Seattle - Sr 520 & NE 51st St Only Next Trip (`mqtt`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_route_st_40_100511_u_district_station_st_1_71341_next_only` — 542 - U-District Station - Sr 520 & NE 51st St Only Next Trip (`mqtt`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_route_st_40_2line_south_bellevue_st_40_e27_t1_next_only` — 2 Line - South Bellevue - Redmond Technology Only Next Trip (`mqtt`) | | | | | |

### `ollama` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Ollama Conversation** | Ollama / qwen3-vl / 8b | `—` | `2a8910a23c9cc4a255ffb6b47640ae88` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `conversation.ollama_conversation` — — (`ollama`) | | | | | |

### `pirateweather` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Pirate Weather** | PirateWeather | `—` | `50c0ccec04b04c7308e65e8b188447be` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.pirate_weather_air_quality_index` — Air Quality Index (`pirateweather`) | | | | | |
|  | ↳ `weather.pirate_weather` — — (`pirateweather`) | | | | | |

### `presence_based_lighting` (18 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Dining Room Presence Lighting** | Presence Based Lighting / Presence Automation | `dining_room` | `31964317a7afa8c9d633d19cf2236d67` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.dining_room_auto_re_enable_end_time` — Dining Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.dining_room_auto_re_enable_start_time` — Dining Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.dining_room_auto_re_enable_presence_lighting` — Dining Room Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.dining_room_presence_dining_room_dimmer_switch_presence_allowed` — Dining Room Presence - Dining Room Dimmer Switch - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.dining_room_auto_re_enable_end_time` — Dining Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.dining_room_auto_re_enable_start_time` — Dining Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Downstairs Hallway Presence Lighting** | Presence Based Lighting / Presence Automation | `downstairs_hallway` | `4175a9b09bfce55e49c5da5a7ff0e728` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.downstairs_hallway_auto_re_enable_end_time` — Downstairs Hallway Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.downstairs_hallway_auto_re_enable_start_time` — Downstairs Hallway Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.downstairs_hallway_auto_re_enable_presence_lighting` — Downstairs Hallway Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.downstairs_hallway_presence_downstairs_hallway_light_presence_allowed` — Downstairs Hallway Presence - Downstairs Hallway Light - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.downstairs_hallway_auto_re_enable_end_time` — Downstairs Hallway Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.downstairs_hallway_auto_re_enable_start_time` — Downstairs Hallway Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Entryway Presence Lighting** | Presence Based Lighting / Presence Automation | `entryway` | `f7e5c22d3e0179cfa18edf2cd5b5e862` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.entryway_auto_re_enable_end_time` — Entryway Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.entryway_auto_re_enable_start_time` — Entryway Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.entryway_auto_re_enable_presence_lighting` — Entryway Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.entryway_presence_top_presence_allowed` — Entryway Presence - Top - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.entryway_auto_re_enable_end_time` — Entryway Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.entryway_auto_re_enable_start_time` — Entryway Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Guest Bathroom Presence Lighting** | Presence Based Lighting / Presence Automation | `guest_bathroom` | `b4879373aba002dfe83e3ce67a469abc` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.guest_bathroom_auto_re_enable_end_time` — Guest Bathroom Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.guest_bathroom_auto_re_enable_start_time` — Guest Bathroom Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.guest_bathroom_auto_re_enable_presence_lighting` — Guest Bathroom Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.guest_bathroom_presence_guest_bathroom_dimmer_switch_presence_allowed` — Guest Bathroom Presence - Guest Bathroom Dimmer Switch - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.guest_bathroom_auto_re_enable_end_time` — Guest Bathroom Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.guest_bathroom_auto_re_enable_start_time` — Guest Bathroom Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Guest Room Presence Lighting** | Presence Based Lighting / Presence Automation | `guest_room` | `2993a80f11cc692d3ecac3d5578ffee7` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.guest_room_auto_re_enable_end_time` — Guest Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.guest_room_auto_re_enable_start_time` — Guest Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.guest_room_auto_re_enable_presence_lighting` — Guest Room Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.guest_room_presence_guest_room_presence_allowed` — Guest Room Presence - Guest Room - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.guest_room_auto_re_enable_end_time` — Guest Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.guest_room_auto_re_enable_start_time` — Guest Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Gym Presence Lighting** | Presence Based Lighting / Presence Automation | `gym` | `1fd851b45c606a2c054a64626fef14bd` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.gym_auto_re_enable_end_time` — Gym Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.gym_auto_re_enable_start_time` — Gym Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.gym_auto_re_enable_presence_lighting` — Gym Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.gym_presence_gym_light_presence_allowed` — Gym Presence - Gym Light - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.gym_auto_re_enable_end_time` — Gym Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.gym_auto_re_enable_start_time` — Gym Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Hallway Presence Lighting** | Presence Based Lighting / Presence Automation | `hallway` | `4a9df06587145fa9ed28c0c137f7c425` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.hallway_auto_re_enable_end_time` — Hallway Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.hallway_auto_re_enable_start_time` — Hallway Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.hallway_auto_re_enable_presence_lighting` — Hallway Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.hallway_presence_hallway_lights_presence_allowed` — Hallway Presence - Hallway Lights - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.hallway_auto_re_enable_end_time` — Hallway Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.hallway_auto_re_enable_start_time` — Hallway Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Kitchen Presence Lighting** | Presence Based Lighting / Presence Automation | `kitchen` | `0cd5db211149270124b61fdb5320dcae` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.kitchen_auto_re_enable_end_time` — Kitchen Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.kitchen_auto_re_enable_start_time` — Kitchen Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.kitchen_auto_re_enable_presence_lighting` — Kitchen Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.kitchen_presence_kitchen_lights_presence_allowed` — Kitchen Presence - Kitchen Lights - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.kitchen_auto_re_enable_end_time` — Kitchen Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.kitchen_auto_re_enable_start_time` — Kitchen Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Living Room Presence Lighting** | Presence Based Lighting / Presence Automation | `living_room` | `f4be3ad7679eae3324f2cc46844be0fc` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.living_room_auto_re_enable_end_time` — Living Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.living_room_auto_re_enable_start_time` — Living Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.living_room_auto_re_enable_presence_lighting` — Living Room Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.living_room_presence_living_room_lights_presence_allowed` — Living Room Presence - Living Room Lights - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.living_room_auto_re_enable_end_time` — Living Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.living_room_auto_re_enable_start_time` — Living Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Master Bathroom (Master Bedroom Lights Off) Presence Lighting** | Presence Based Lighting / Presence Automation | `master_bathroom` | `ae1f827d0ab0e74012920fe5d1163a90` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.master_bathroom_master_bedroom_lights_off_presence_lighting_master_bathroom_master_bedroom_lights_off_auto_re_enable_presence_lighting` — Master Bathroom (Master Bedroom Lights Off) Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bathroom_master_bedroom_lights_off_presence_master_bathroom_dimmer_switch_presence_allowed` — Master Bathroom (Master Bedroom Lights Off) Presence - Master Bathroom Dimmer Switch - Presence Allowed (`presence_based_lighting`) | | | | | |
| [ ] | **Master Bathroom Presence Lighting** | Presence Based Lighting / Presence Automation | `master_bathroom` | `083a1f3be0bca35a20e911cd3d2619df` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.master_bathroom_auto_re_enable_end_time` — Master Bathroom Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.master_bathroom_auto_re_enable_start_time` — Master Bathroom Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bathroom_auto_re_enable_presence_lighting` — Master Bathroom Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed` — Master Bathroom Presence - Master Bathroom Dimmer Switch - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.master_bathroom_auto_re_enable_end_time` — Master Bathroom Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.master_bathroom_auto_re_enable_start_time` — Master Bathroom Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Master Bedroom Closet (Presence Lighting Disabled) Presence Lighting** | Presence Based Lighting / Presence Automation | `master_bedroom` | `c6ab50ac7e4d2ab0753cb8a7df1ac679` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `switch.master_bedroom_closet_presence_lighting_disabled_auto_re_enable_presence_lighting` — Master Bedroom Closet (Presence Lighting Disabled) Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bedroom_closet_presence_lighting_disabled_presence_master_bedroom_closet_light_presence_allowed` — Master Bedroom Closet (Presence Lighting Disabled) Presence - Master Bedroom Closet Light - Presence Allowed (`presence_based_lighting`) | | | | | |
| [ ] | **Master Bedroom Closet Presence Lighting** | Presence Based Lighting / Presence Automation | `master_bedroom` | `1d7359b33fb616a1e48806cae5cb94ab` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.master_bedroom_closet_auto_re_enable_end_time` — Master Bedroom Closet Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.master_bedroom_closet_auto_re_enable_start_time` — Master Bedroom Closet Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bedroom_closet_auto_re_enable_presence_lighting` — Master Bedroom Closet Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bedroom_closet_presence_master_bedroom_closet_light_presence_allowed` — Master Bedroom Closet Presence - Master Bedroom Closet Light - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.master_bedroom_closet_auto_re_enable_end_time` — Master Bedroom Closet Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.master_bedroom_closet_auto_re_enable_start_time` — Master Bedroom Closet Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Master Bedroom Presence Lighting** | Presence Based Lighting / Presence Automation | `master_bedroom` | `70a4efa769dd081781d53f50ea363a87` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.master_bedroom_auto_re_enable_end_time` — Master Bedroom Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.master_bedroom_auto_re_enable_start_time` — Master Bedroom Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bedroom_auto_re_enable_presence_lighting` — Master Bedroom Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.master_bedroom_presence_master_bedroom_presence_allowed` — Master Bedroom Presence - Master Bedroom - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.master_bedroom_auto_re_enable_end_time` — Master Bedroom Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.master_bedroom_auto_re_enable_start_time` — Master Bedroom Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Music Room Presence Lighting** | Presence Based Lighting / Presence Automation | `music_room` | `1a7b03377e5ed99ebf3826012027834f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.music_room_auto_re_enable_end_time` — Music Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.music_room_auto_re_enable_start_time` — Music Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.music_room_auto_re_enable_presence_lighting` — Music Room Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.music_room_presence_music_room_lights_presence_allowed` — Music Room Presence - Music Room Lights - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.music_room_auto_re_enable_end_time` — Music Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.music_room_auto_re_enable_start_time` — Music Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Office Presence Lighting** | Presence Based Lighting / Presence Automation | `office` | `7f06f34f55fd49a89671edc6643c0fa7` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.office_auto_re_enable_end_time` — Office Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.office_auto_re_enable_start_time` — Office Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.office_auto_re_enable_presence_lighting` — Office Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.office_presence_office_light_presence_allowed` — Office Presence - Office Light - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.office_auto_re_enable_end_time` — Office Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.office_auto_re_enable_start_time` — Office Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Theater Room Presence Lighting** | Presence Based Lighting / Presence Automation | `theater_room` | `7f8c1e68a85cce35210b59a191363488` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.theater_room_auto_re_enable_end_time` — Theater Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.theater_room_auto_re_enable_start_time` — Theater Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.theater_room_auto_re_enable_presence_lighting` — Theater Room Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.theater_room_presence_theater_room_presence_allowed` — Theater Room Presence - Theater Room - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.theater_room_auto_re_enable_end_time` — Theater Room Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.theater_room_auto_re_enable_start_time` — Theater Room Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
| [ ] | **Upper Deck Presence Lighting** | Presence Based Lighting / Presence Automation | `upper_deck` | `9d111e2b339162cad3cb7d031f489ae0` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `datetime.upper_deck_auto_re_enable_end_time` — Upper Deck Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `datetime.upper_deck_auto_re_enable_start_time` — Upper Deck Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.upper_deck_auto_re_enable_presence_lighting` — Upper Deck Auto Re-Enable Presence Lighting (`presence_based_lighting`) | | | | | |
|  | ↳ `switch.upper_deck_presence_back_deck_lights_presence_allowed` — Upper Deck Presence - Back Deck Lights - Presence Allowed (`presence_based_lighting`) | | | | | |
|  | ↳ `time.upper_deck_auto_re_enable_end_time` — Upper Deck Auto Re-Enable End Time (`presence_based_lighting`) | | | | | |
|  | ↳ `time.upper_deck_auto_re_enable_start_time` — Upper Deck Auto Re-Enable Start Time (`presence_based_lighting`) | | | | | |

### `reolink` (2 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Garage Camera** | Reolink / Elite Floodlight WiFi / v3.2.0.6530_2606232191 | `garage` | `441b06b9c42f6754ac7c0a0e5702b289` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.garage_camera_animal` — Animal (`reolink`) | | | | | |
|  | ↳ `binary_sensor.garage_camera_motion` — Motion (`reolink`) | | | | | |
|  | ↳ `binary_sensor.garage_camera_person` — Person (`reolink`) | | | | | |
|  | ↳ `binary_sensor.garage_camera_vehicle` — Vehicle (`reolink`) | | | | | |
|  | ↳ `button.garage_garage_camera_synchronize_time` — Synchronize time (`reolink`) | | | | | |
|  | ↳ `button.garage_restart` — Restart (`reolink`) | | | | | |
|  | ↳ `camera.garage_camera_fluent` — Fluent (`reolink`) | | | | | |
|  | ↳ `camera.garage_clear` — Clear (`reolink`) | | | | | |
|  | ↳ `camera.garage_snapshots_clear` — Snapshots clear (`reolink`) | | | | | |
|  | ↳ `camera.garage_snapshots_fluent` — Snapshots fluent (`reolink`) | | | | | |
|  | ↳ `light.garage_camera_floodlight` — Floodlight (`reolink`) | | | | | |
|  | ↳ `light.garage_camera_status_led` — Status LED (`reolink`) | | | | | |
|  | ↳ `number.garage_ai_animal_delay` — AI animal delay (`reolink`) | | | | | |
|  | ↳ `number.garage_ai_person_delay` — AI person delay (`reolink`) | | | | | |
|  | ↳ `number.garage_ai_vehicle_delay` — AI vehicle delay (`reolink`) | | | | | |
|  | ↳ `number.garage_audio_noise_reduction` — Audio noise reduction (`reolink`) | | | | | |
|  | ↳ `number.garage_camera_ai_animal_sensitivity` — AI animal sensitivity (`reolink`) | | | | | |
|  | ↳ `number.garage_camera_ai_person_sensitivity` — AI person sensitivity (`reolink`) | | | | | |
|  | ↳ `number.garage_camera_ai_vehicle_sensitivity` — AI vehicle sensitivity (`reolink`) | | | | | |
|  | ↳ `number.garage_camera_motion_sensitivity` — Motion sensitivity (`reolink`) | | | | | |
|  | ↳ `number.garage_camera_volume` — Volume (`reolink`) | | | | | |
|  | ↳ `number.garage_day_night_switch_threshold` — Day night switch threshold (`reolink`) | | | | | |
|  | ↳ `number.garage_floodlight_event_brightness` — Floodlight event brightness (`reolink`) | | | | | |
|  | ↳ `number.garage_floodlight_event_flash_time` — Floodlight event flash time (`reolink`) | | | | | |
|  | ↳ `number.garage_floodlight_event_on_time` — Floodlight event on time (`reolink`) | | | | | |
|  | ↳ `number.garage_floodlight_turn_on_brightness` — Floodlight turn on brightness (`reolink`) | | | | | |
|  | ↳ `number.garage_image_brightness` — Image brightness (`reolink`) | | | | | |
|  | ↳ `number.garage_image_contrast` — Image contrast (`reolink`) | | | | | |
|  | ↳ `number.garage_image_saturation` — Image saturation (`reolink`) | | | | | |
|  | ↳ `number.garage_image_sharpness` — Image sharpness (`reolink`) | | | | | |
|  | ↳ `select.garage_camera_day_night_mode` — Day night mode (`reolink`) | | | | | |
|  | ↳ `select.garage_camera_floodlight_event_mode` — Floodlight event mode (`reolink`) | | | | | |
|  | ↳ `select.garage_camera_floodlight_mode` — Floodlight mode (`reolink`) | | | | | |
|  | ↳ `select.garage_clear_bit_rate` — Clear bit rate (`reolink`) | | | | | |
|  | ↳ `select.garage_clear_frame_rate` — Clear frame rate (`reolink`) | | | | | |
|  | ↳ `select.garage_fluent_bit_rate` — Fluent bit rate (`reolink`) | | | | | |
|  | ↳ `select.garage_fluent_frame_rate` — Fluent frame rate (`reolink`) | | | | | |
|  | ↳ `select.garage_garage_camera_anti_flicker` — Anti-flicker (`reolink`) | | | | | |
|  | ↳ `select.garage_post_recording_time` — Post-recording time (`reolink`) | | | | | |
|  | ↳ `sensor.garage_camera_day_night_state` — Day night state (`reolink`) | | | | | |
|  | ↳ `sensor.garage_cpu_usage` — CPU usage (`reolink`) | | | | | |
|  | ↳ `sensor.garage_wi_fi_signal` — Wi-Fi signal (`reolink`) | | | | | |
|  | ↳ `siren.garage_camera_siren` — Siren (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_email_on_event` — Email on event (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_ftp_upload` — FTP upload (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_infrared_lights_in_night_mode` — Infrared lights in night mode (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_privacy_mode` — Privacy mode (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_push_notifications` — Push notifications (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_record` — Record (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_record_audio` — Record audio (`reolink`) | | | | | |
|  | ↳ `switch.garage_camera_siren_on_event` — Siren on event (`reolink`) | | | | | |
|  | ↳ `time.garage_garage_camera_floodlight_schedule_end` — Floodlight schedule end (`reolink`) | | | | | |
|  | ↳ `time.garage_garage_camera_floodlight_schedule_start` — Floodlight schedule start (`reolink`) | | | | | |
|  | ↳ `update.garage_camera_firmware` — Firmware (`reolink`) | | | | | |
| [ ] | **Garage Camera** | Reolink / Elite Floodlight WiFi / v3.2.0.6530_2606232191 | `garage` | `3024ada99f67e567a20775c29d36d842` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.garage_floodlight` — Garage Floodlight (`real_last_changed`) | | | | | |

### `sonos` (7 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Beam** | Sonos / Beam / 18.7 | `beam` | `80f55ce863299cc7d19a79aab5d6ac7b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.beam_microphone` — Microphone (`sonos`) | | | | | |
|  | ↳ `button.beam_beam_cancel_announcement` — Cancel announcement (`sonos`) | | | | | |
|  | ↳ `media_player.beam` — — (`sonos`) | | | | | |
|  | ↳ `number.beam_audio_delay` — Audio delay (`sonos`) | | | | | |
|  | ↳ `number.beam_balance` — Balance (`sonos`) | | | | | |
|  | ↳ `number.beam_bass` — Bass (`sonos`) | | | | | |
|  | ↳ `number.beam_music_surround_level` — Music surround level (`sonos`) | | | | | |
|  | ↳ `number.beam_surround_level` — Surround level (`sonos`) | | | | | |
|  | ↳ `number.beam_treble` — Treble (`sonos`) | | | | | |
|  | ↳ `sensor.beam_audio_input_format` — Audio input format (`sonos`) | | | | | |
|  | ↳ `switch.beam_crossfade` — Crossfade (`sonos`) | | | | | |
|  | ↳ `switch.beam_loudness` — Loudness (`sonos`) | | | | | |
|  | ↳ `switch.beam_night_sound` — Night sound (`sonos`) | | | | | |
|  | ↳ `switch.beam_speech_enhancement` — Speech enhancement (`sonos`) | | | | | |
|  | ↳ `switch.beam_status_light` — Status light (`sonos`) | | | | | |
|  | ↳ `switch.beam_surround_enabled` — Surround enabled (`sonos`) | | | | | |
|  | ↳ `switch.beam_surround_music_full_volume` — Surround music full volume (`sonos`) | | | | | |
|  | ↳ `switch.beam_touch_controls` — Touch controls (`sonos`) | | | | | |
|  | ↳ `switch.beam_tv_autoplay` — TV autoplay (`sonos`) | | | | | |
|  | ↳ `switch.beam_ungroup_on_autoplay` — Ungroup on autoplay (`sonos`) | | | | | |
| [ ] | **Primary Bedroom** | Sonos / Beam / 18.7 | `master_bedroom` | `3a51ca9213be2f6cf6605e5232f06093` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.primary_bedroom_microphone` — Microphone (`sonos`) | | | | | |
|  | ↳ `button.master_bedroom_primary_bedroom_cancel_announcement` — Cancel announcement (`sonos`) | | | | | |
|  | ↳ `media_player.primary_bedroom` — — (`sonos`) | | | | | |
|  | ↳ `number.primary_bedroom_audio_delay` — Audio delay (`sonos`) | | | | | |
|  | ↳ `number.primary_bedroom_balance` — Balance (`sonos`) | | | | | |
|  | ↳ `number.primary_bedroom_bass` — Bass (`sonos`) | | | | | |
|  | ↳ `number.primary_bedroom_music_surround_level` — Music surround level (`sonos`) | | | | | |
|  | ↳ `number.primary_bedroom_surround_level` — Surround level (`sonos`) | | | | | |
|  | ↳ `number.primary_bedroom_treble` — Treble (`sonos`) | | | | | |
|  | ↳ `sensor.primary_bedroom_audio_input_format` — Audio input format (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_crossfade` — Crossfade (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_loudness` — Loudness (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_night_sound` — Night sound (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_speech_enhancement` — Speech enhancement (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_status_light` — Status light (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_surround_enabled` — Surround enabled (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_surround_music_full_volume` — Surround music full volume (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_touch_controls` — Touch controls (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_tv_autoplay` — TV autoplay (`sonos`) | | | | | |
|  | ↳ `switch.primary_bedroom_ungroup_on_autoplay` — Ungroup on autoplay (`sonos`) | | | | | |
| [ ] | **Office 2** | Sonos / SYMFONISK Bookshelf / 17.2.6 | `office` | `18cbee1a90dc27eaf84eada307dc3876` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.office_office_2_cancel_announcement` — Cancel announcement (`sonos`) | | | | | |
|  | ↳ `media_player.office` — — (`sonos`) | | | | | |
|  | ↳ `number.office_balance` — Balance (`sonos`) | | | | | |
|  | ↳ `number.office_bass` — Bass (`sonos`) | | | | | |
|  | ↳ `number.office_treble` — Treble (`sonos`) | | | | | |
|  | ↳ `switch.office_2_tv_autoplay` — TV autoplay (`sonos`) | | | | | |
|  | ↳ `switch.office_2_ungroup_on_autoplay` — Ungroup on autoplay (`sonos`) | | | | | |
|  | ↳ `switch.office_crossfade` — Crossfade (`sonos`) | | | | | |
|  | ↳ `switch.office_loudness` — Loudness (`sonos`) | | | | | |
|  | ↳ `switch.office_status_light` — Status light (`sonos`) | | | | | |
|  | ↳ `switch.office_touch_controls` — Touch controls (`sonos`) | | | | | |
| [ ] | **Port** | Sonos / Port / 18.7 | `port` | `525b38fed2d5ba9c82fb5b665078aa22` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.port_port_cancel_announcement` — Cancel announcement (`sonos`) | | | | | |
|  | ↳ `media_player.port` — — (`sonos`) | | | | | |
|  | ↳ `number.port_balance` — Balance (`sonos`) | | | | | |
|  | ↳ `number.port_bass` — Bass (`sonos`) | | | | | |
|  | ↳ `number.port_treble` — Treble (`sonos`) | | | | | |
|  | ↳ `switch.port_crossfade` — Crossfade (`sonos`) | | | | | |
|  | ↳ `switch.port_loudness` — Loudness (`sonos`) | | | | | |
|  | ↳ `switch.port_status_light` — Status light (`sonos`) | | | | | |
|  | ↳ `switch.port_touch_controls` — Touch controls (`sonos`) | | | | | |
|  | ↳ `switch.port_tv_autoplay` — TV autoplay (`sonos`) | | | | | |
|  | ↳ `switch.port_ungroup_on_autoplay` — Ungroup on autoplay (`sonos`) | | | | | |
| [ ] | **Port** | Sonos / Port / 18.7 | `port` | `cace3d8f1efda54a483f905d2ff8ced6` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.port_port_cancel_announcement_2` — Cancel announcement (`sonos`) | | | | | |
|  | ↳ `media_player.port_2` — — (`sonos`) | | | | | |
|  | ↳ `number.port_balance_2` — Balance (`sonos`) | | | | | |
|  | ↳ `number.port_bass_2` — Bass (`sonos`) | | | | | |
|  | ↳ `number.port_treble_2` — Treble (`sonos`) | | | | | |
|  | ↳ `switch.port_crossfade_2` — Crossfade (`sonos`) | | | | | |
|  | ↳ `switch.port_loudness_2` — Loudness (`sonos`) | | | | | |
|  | ↳ `switch.port_status_light_2` — Status light (`sonos`) | | | | | |
|  | ↳ `switch.port_touch_controls_2` — Touch controls (`sonos`) | | | | | |
|  | ↳ `switch.port_tv_autoplay_2` — TV autoplay (`sonos`) | | | | | |
|  | ↳ `switch.port_ungroup_on_autoplay_2` — Ungroup on autoplay (`sonos`) | | | | | |
| [ ] | **Sonos** | Sonos / Arc / 18.7 | `sonos` | `4beec4862c4675a9f5d071b1c2a0e2e3` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.sonos_microphone` — Microphone (`sonos`) | | | | | |
|  | ↳ `button.sonos_sonos_cancel_announcement` — Cancel announcement (`sonos`) | | | | | |
|  | ↳ `media_player.sonos` — — (`sonos`) | | | | | |
|  | ↳ `number.sonos_audio_delay` — Audio delay (`sonos`) | | | | | |
|  | ↳ `number.sonos_balance` — Balance (`sonos`) | | | | | |
|  | ↳ `number.sonos_bass` — Bass (`sonos`) | | | | | |
|  | ↳ `number.sonos_music_surround_level` — Music surround level (`sonos`) | | | | | |
|  | ↳ `number.sonos_sub_gain` — Sub gain (`sonos`) | | | | | |
|  | ↳ `number.sonos_surround_level` — Surround level (`sonos`) | | | | | |
|  | ↳ `number.sonos_treble` — Treble (`sonos`) | | | | | |
|  | ↳ `sensor.sonos_audio_input_format` — Audio input format (`sonos`) | | | | | |
|  | ↳ `switch.sonos_crossfade` — Crossfade (`sonos`) | | | | | |
|  | ↳ `switch.sonos_loudness` — Loudness (`sonos`) | | | | | |
|  | ↳ `switch.sonos_night_sound` — Night sound (`sonos`) | | | | | |
|  | ↳ `switch.sonos_speech_enhancement` — Speech enhancement (`sonos`) | | | | | |
|  | ↳ `switch.sonos_status_light` — Status light (`sonos`) | | | | | |
|  | ↳ `switch.sonos_subwoofer_enabled` — Subwoofer enabled (`sonos`) | | | | | |
|  | ↳ `switch.sonos_surround_enabled` — Surround enabled (`sonos`) | | | | | |
|  | ↳ `switch.sonos_surround_music_full_volume` — Surround music full volume (`sonos`) | | | | | |
|  | ↳ `switch.sonos_touch_controls` — Touch controls (`sonos`) | | | | | |
|  | ↳ `switch.sonos_tv_autoplay` — TV autoplay (`sonos`) | | | | | |
|  | ↳ `switch.sonos_ungroup_on_autoplay` — Ungroup on autoplay (`sonos`) | | | | | |
| [ ] | **Upper Deck** | Sonos / Play:1 / 17.2.6 | `upper_deck` | `a5d1d7e959b5626f24f77dfddbcd42af` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.upper_deck_upper_deck_cancel_announcement` — Cancel announcement (`sonos`) | | | | | |
|  | ↳ `media_player.upper_deck` — — (`sonos`) | | | | | |
|  | ↳ `number.upper_deck_balance` — Balance (`sonos`) | | | | | |
|  | ↳ `number.upper_deck_bass` — Bass (`sonos`) | | | | | |
|  | ↳ `number.upper_deck_treble` — Treble (`sonos`) | | | | | |
|  | ↳ `switch.upper_deck_crossfade` — Crossfade (`sonos`) | | | | | |
|  | ↳ `switch.upper_deck_loudness` — Loudness (`sonos`) | | | | | |
|  | ↳ `switch.upper_deck_status_light` — Status light (`sonos`) | | | | | |
|  | ↳ `switch.upper_deck_touch_controls` — Touch controls (`sonos`) | | | | | |
|  | ↳ `switch.upper_deck_tv_autoplay` — TV autoplay (`sonos`) | | | | | |
|  | ↳ `switch.upper_deck_ungroup_on_autoplay` — Ungroup on autoplay (`sonos`) | | | | | |

### `sony_projector_adcp` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Sony Projector** | Sony / VPL-XW5000 | `theater_room` | `c172f9481cc742ec2e922a4f4afcd63e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.sony_projector` — — (`sony_projector_adcp`) | | | | | |

### `sun` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Sun** | — | `—` | `4135f23d0d326937fde75cbf3ef97e40` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.sun_solar_rising` — Solar rising (`sun`) | | | | | |
|  | ↳ `sensor.sun_next_dawn` — Next dawn (`sun`) | | | | | |
|  | ↳ `sensor.sun_next_dusk` — Next dusk (`sun`) | | | | | |
|  | ↳ `sensor.sun_next_midnight` — Next midnight (`sun`) | | | | | |
|  | ↳ `sensor.sun_next_noon` — Next noon (`sun`) | | | | | |
|  | ↳ `sensor.sun_next_rising` — Next rising (`sun`) | | | | | |
|  | ↳ `sensor.sun_next_setting` — Next setting (`sun`) | | | | | |
|  | ↳ `sensor.sun_solar_azimuth` — Solar azimuth (`sun`) | | | | | |
|  | ↳ `sensor.sun_solar_elevation` — Solar elevation (`sun`) | | | | | |

### `synology_dsm` (18 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Rackstation-1** | Synology / RS819 / DSM 7.0.1-42218 Update 7 | `music_room` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_1_security_status` — Security status (`synology_dsm`) | | | | | |
|  | ↳ `button.rackstation_1_reboot` — Restart (`synology_dsm`) | | | | | |
|  | ↳ `button.rackstation_1_shutdown` — Shut down (`synology_dsm`) | | | | | |
|  | ↳ `select.music_room_rackstation_1_fan_speed_mode` — Fan speed mode (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_cpu_load_average_15_min` — CPU load average (15 min) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_cpu_load_average_1_min` — CPU load average (1 min) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_cpu_load_average_5_min` — CPU load average (5 min) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_cpu_utilization_other` — CPU utilization (other) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_cpu_utilization_system` — CPU utilization (system) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_cpu_utilization_total` — CPU utilization (total) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_cpu_utilization_user` — CPU utilization (user) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_download_throughput` — Download throughput (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_last_boot` — Uptime (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_memory_available_real` — Memory available (real) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_memory_available_swap` — Memory available (swap) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_memory_cached` — Memory cached (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_memory_size` — Memory size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_memory_total_real` — Memory total (real) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_memory_total_swap` — Memory total (swap) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_memory_usage_real` — Memory usage (real) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_temperature` — Temperature (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_upload_throughput` — Upload throughput (`synology_dsm`) | | | | | |
|  | ↳ `update.rackstation_1_dsm_update` — DSM update (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Drive 1)** | Seagate / ST12000NM0008-2H3101 / SN02 | `music_room` | `24e116bd06abbc03c0c19144277c9bee` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_1_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_1_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_1_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_1_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_1_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Drive 2)** | Seagate / ST8000DM004-2U9188 / 0001 | `music_room` | `ca66545fc278740b9ebc8981d83904d5` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_2_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_2_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_2_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_2_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_2_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Drive 3)** | Seagate / ST8000DM004-2CX188 / 0001 | `music_room` | `cf1bba0ec40ff3c48b71ffd65738106a` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_3_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_3_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_3_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_3_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_3_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Drive 4)** | Seagate / ST8000DM004-2U9188 / 0001 | `music_room` | `8c18936875d27da1fbe3b58105f309f2` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_4_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_1_drive_4_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_4_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_4_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_drive_4_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Volume 1)** | Synology / RS819 / DSM 7.0.1-42218 Update 7 | `music_room` | `a3d692d0f1795baddd6d12542ea4350b` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_1_volume_1_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_1_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_1_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_1_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_1_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_1_volume_used` — Volume used (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Volume 2)** | Synology / RS819 / DSM 7.0.1-42218 Update 7 | `music_room` | `cf5a65dc53d3741c3a25ca56e144e0cb` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_1_volume_2_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_2_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_2_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_2_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_2_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_2_volume_used` — Volume used (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Volume 3)** | Synology / RS819 / DSM 7.0.1-42218 Update 7 | `music_room` | `933691c3ee58bd33080c70009fcd9eb8` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_1_volume_3_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_3_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_3_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_3_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_3_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_3_volume_used` — Volume used (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-1 (Volume 4)** | Synology / RS819 / DSM 7.0.1-42218 Update 7 | `music_room` | `3f5787369235522a1d81fb8aefe90485` | `18fc51ac68e7d70bdcfec10d086c05e5` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_1_volume_4_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_4_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_4_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_4_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_4_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_1_volume_4_volume_used` — Volume used (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2** | Synology / RS819 / DSM 7.2.2-72806 Update 9 | `music_room` | `92f153a3f18c5ac5382159e82901f0c1` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_2_security_status` — Security status (`synology_dsm`) | | | | | |
|  | ↳ `button.rackstation_2_reboot` — Restart (`synology_dsm`) | | | | | |
|  | ↳ `button.rackstation_2_shutdown` — Shut down (`synology_dsm`) | | | | | |
|  | ↳ `select.music_room_rackstation_2_fan_speed_mode` — Fan speed mode (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_cpu_load_average_15_min` — CPU load average (15 min) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_cpu_load_average_1_min` — CPU load average (1 min) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_cpu_load_average_5_min` — CPU load average (5 min) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_cpu_utilization_other` — CPU utilization (other) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_cpu_utilization_system` — CPU utilization (system) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_cpu_utilization_total` — CPU utilization (total) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_cpu_utilization_user` — CPU utilization (user) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_download_throughput` — Download throughput (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_last_boot` — Uptime (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_memory_available_real` — Memory available (real) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_memory_available_swap` — Memory available (swap) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_memory_cached` — Memory cached (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_memory_size` — Memory size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_memory_total_real` — Memory total (real) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_memory_total_swap` — Memory total (swap) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_memory_usage_real` — Memory usage (real) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_temperature` — Temperature (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_upload_throughput` — Upload throughput (`synology_dsm`) | | | | | |
|  | ↳ `update.rackstation_2_dsm_update` — DSM update (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Drive 1)** | Seagate / ST8000DM0004-1ZC11G / DN01 | `music_room` | `06b71c66dee6e9b29acaa461935b61a8` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_1_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_1_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_1_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_1_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_1_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Drive 2)** | Seagate / ST8000DM004-2CX188 / 0001 | `music_room` | `147033f7eaad1cbd181f0d32911e0e93` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_2_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_2_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_2_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_2_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_2_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Drive 3)** | Seagate / ST12000VN0008-2YS101 / SC60 | `music_room` | `50cf97cdae56f508ebc2c25f15907eb1` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_3_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_3_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_3_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_3_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_3_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Drive 4)** | Seagate / ST26000NM000C-3WE103 / SN02 | `music_room` | `279c969d49c51324a1b8f5439cbb735b` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_4_below_min_remaining_life` — Below min remaining life (`synology_dsm`) | | | | | |
|  | ↳ `binary_sensor.rackstation_2_drive_4_exceeded_max_bad_sectors` — Exceeded max bad sectors (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_4_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_4_status_smart` — Status (smart) (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_drive_4_temperature` — Temperature (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Volume 1)** | Synology / RS819 / DSM 7.2.2-72806 Update 9 | `music_room` | `25782a2caddb1c509b9e18e509e2e39e` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_2_volume_1_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_1_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_1_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_1_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_1_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_1_volume_used` — Volume used (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Volume 2)** | Synology / RS819 / DSM 7.2.2-72806 Update 9 | `music_room` | `25de687fee21e4c840455a7270f32154` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_2_volume_2_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_2_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_2_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_2_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_2_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_2_volume_used` — Volume used (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Volume 3)** | Synology / RS819 / DSM 7.2.2-72806 Update 9 | `music_room` | `d1d531fd14270fa30b7e5800b5529686` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_2_volume_3_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_3_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_3_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_3_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_3_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_3_volume_used` — Volume used (`synology_dsm`) | | | | | |
| [ ] | **Rackstation-2 (Volume 4)** | Synology / RS819 / DSM 7.2.2-72806 Update 9 | `music_room` | `6b2cedf3857d91bf84e44808ab2114d8` | `92f153a3f18c5ac5382159e82901f0c1` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.rackstation_2_volume_4_average_disk_temp` — Average disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_4_maximum_disk_temp` — Maximum disk temp (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_4_status` — Status (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_4_total_size` — Total size (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_4_used_space` — Used space (`synology_dsm`) | | | | | |
|  | ↳ `sensor.rackstation_2_volume_4_volume_used` — Volume used (`synology_dsm`) | | | | | |

### `systemmonitor` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **System Monitor** | System Monitor | `—` | `8f940e84708ce828c0337cbf0540fa4e` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.system_monitor_charging` — Charging (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_battery` — Battery (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_battery_empty` — Battery empty (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_cpu_pressure_some_10s_average` — CPU pressure some 10s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_cpu_pressure_some_300s_average` — CPU pressure some 300s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_cpu_pressure_some_60s_average` — CPU pressure some 60s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_cpu_pressure_some_total` — CPU pressure some total (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_free` — Disk free / (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_free_config` — Disk free /config (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_free_media` — Disk free /media (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_free_run_audio` — Disk free /run/audio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_free_share` — Disk free /share (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_free_ssl` — Disk free /ssl (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_usage` — Disk usage / (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_usage_config` — Disk usage /config (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_usage_media` — Disk usage /media (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_usage_run_audio` — Disk usage /run/audio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_usage_share` — Disk usage /share (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_usage_ssl` — Disk usage /ssl (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_use` — Disk use / (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_use_config` — Disk use /config (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_use_media` — Disk use /media (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_use_run_audio` — Disk use /run/audio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_use_share` — Disk use /share (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_disk_use_ssl` — Disk use /ssl (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_full_10s_average` — IO pressure full 10s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_full_300s_average` — IO pressure full 300s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_full_60s_average` — IO pressure full 60s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_full_total` — IO pressure full total (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_some_10s_average` — IO pressure some 10s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_some_300s_average` — IO pressure some 300s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_some_60s_average` — IO pressure some 60s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_io_pressure_some_total` — IO pressure some total (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv4_address_docker0` — IPv4 address docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv4_address_end0` — IPv4 address end0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv4_address_enp0s3` — IPv4 address enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv4_address_hassio` — IPv4 address hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv4_address_lo` — IPv4 address lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv6_address_docker0` — IPv6 address docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv6_address_end0` — IPv6 address end0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv6_address_enp0s3` — IPv6 address enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv6_address_hassio` — IPv6 address hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_ipv6_address_lo` — IPv6 address lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_last_boot` — Uptime (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_load_15_min` — Load (15 min) (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_load_1_min` — Load (1 min) (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_load_5_min` — Load (5 min) (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_free` — Memory free (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_full_10s_average` — Memory pressure full 10s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_full_300s_average` — Memory pressure full 300s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_full_60s_average` — Memory pressure full 60s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_full_total` — Memory pressure full total (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_some_10s_average` — Memory pressure some 10s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_some_300s_average` — Memory pressure some 300s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_some_60s_average` — Memory pressure some 60s average (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_pressure_some_total` — Memory pressure some total (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_usage` — Memory usage (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_memory_use` — Memory use (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_in_docker0` — Network in docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_in_enp0s3` — Network in enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_in_hassio` — Network in hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_in_lo` — Network in lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_out_docker0` — Network out docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_out_enp0s3` — Network out enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_out_hassio` — Network out hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_out_lo` — Network out lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_in_docker0` — Network throughput in docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_in_enp0s3` — Network throughput in enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_in_hassio` — Network throughput in hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_in_lo` — Network throughput in lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_out_docker0` — Network throughput out docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_out_enp0s3` — Network throughput out enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_out_hassio` — Network throughput out hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_network_throughput_out_lo` — Network throughput out lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_in_docker0` — Packets in docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_in_enp0s3` — Packets in enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_in_hassio` — Packets in hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_in_lo` — Packets in lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_out_docker0` — Packets out docker0 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_out_enp0s3` — Packets out enp0s3 (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_out_hassio` — Packets out hassio (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_packets_out_lo` — Packets out lo (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_processor_temperature` — Processor temperature (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_processor_use` — Processor use (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_swap_free` — Swap free (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_swap_usage` — Swap usage (`systemmonitor`) | | | | | |
|  | ↳ `sensor.system_monitor_swap_use` — Swap use (`systemmonitor`) | | | | | |

### `thermostat_contact_sensors` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Thermostat Contact Sensors** | Custom Integration / Thermostat Contact Sensors | `living_room` | `cd287be47522d8a9cf1357c8960f9f7c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.thermostat_contact_sensors_away_mode_active` — Away Mode Active (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `binary_sensor.thermostat_contact_sensors_thermostat_paused` — Thermostat Paused (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_dining_room_virtual_thermostat` — Dining Room Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_eco_away_virtual_thermostat` — Eco Away Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_global_virtual_thermostat` — Global Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_guest_bathroom_virtual_thermostat` — Guest Bathroom Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_guest_room_virtual_thermostat` — Guest Room Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_gym_virtual_thermostat` — Gym Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_kitchen_virtual_thermostat` — Kitchen Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_living_room_virtual_thermostat` — Living Room Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_master_bathroom_virtual_thermostat` — Master Bathroom Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_master_bedroom_virtual_thermostat` — Master Bedroom Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_music_room_virtual_thermostat` — Music Room Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_office_virtual_thermostat` — Office Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `climate.thermostat_contact_sensors_theater_room_virtual_thermostat` — Theater Room Virtual Thermostat (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `select.thermostat_contact_sensors_eco_behavior_when_away` — Eco Behavior When Away (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `select.thermostat_contact_sensors_eco_mode_critical_tracking` — Eco Mode Critical Tracking (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode` — Predictive Comfort Mode (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_dining_room_occupancy` — Dining Room Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_dining_room_temperature` — Dining Room Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_guest_bathroom_occupancy` — Guest Bathroom Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_guest_bathroom_temperature` — Guest Bathroom Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_guest_room_occupancy` — Guest Room Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_guest_room_temperature` — Guest Room Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_gym_occupancy` — Gym Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_gym_temperature` — Gym Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_kitchen_occupancy` — Kitchen Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_kitchen_temperature` — Kitchen Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_living_room_occupancy` — Living Room Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_living_room_temperature` — Living Room Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_master_bathroom_occupancy` — Master Bathroom Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_master_bathroom_temperature` — Master Bathroom Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_master_bedroom_occupancy` — Master Bedroom Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_master_bedroom_temperature` — Master Bedroom Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_music_room_occupancy` — Music Room Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_music_room_temperature` — Music Room Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_office_occupancy` — Office Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_office_temperature` — Office Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_open_sensors` — Open Sensors (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_theater_room_occupancy` — Theater Room Occupancy (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_theater_room_temperature` — Theater Room Temperature (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `sensor.thermostat_contact_sensors_thermostat_control` — Thermostat Control (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_dining_room_track_only_when_occupied` — Dining Room Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_guest_bathroom_track_only_when_occupied` — Guest Bathroom Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_guest_room_track_only_when_occupied` — Guest Room Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_gym_track_only_when_occupied` — Gym Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_kitchen_track_only_when_occupied` — Kitchen Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_living_room_track_only_when_occupied` — Living Room Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_master_bathroom_track_only_when_occupied` — Master Bathroom Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_master_bedroom_track_only_when_occupied` — Master Bedroom Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_music_room_track_only_when_occupied` — Music Room Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_office_track_only_when_occupied` — Office Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.living_room_thermostat_contact_sensors_theater_room_track_only_when_occupied` — Theater Room Track Only When Occupied (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_dining_room_force_track_when_critical` — Dining Room Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_eco_mode` — Eco Mode (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_dining_room` — Force Track Critical State Dining Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_guest_bathroom` — Force Track Critical State Guest Bathroom (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_guest_room` — Force Track Critical State Guest Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_gym` — Force Track Critical State Gym (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_kitchen` — Force Track Critical State Kitchen (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_living_room` — Force Track Critical State Living Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_master_bathroom` — Force Track Critical State Master Bathroom (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_master_bedroom` — Force Track Critical State Master Bedroom (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_music_room` — Force Track Critical State Music Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_office` — Force Track Critical State Office (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_force_track_critical_state_theater_room` — Force Track Critical State Theater Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_guest_bathroom_force_track_when_critical` — Guest Bathroom Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_guest_room_force_track_when_critical` — Guest Room Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_gym_force_track_when_critical` — Gym Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_kitchen_force_track_when_critical` — Kitchen Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_living_room_force_track_when_critical` — Living Room Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_master_bathroom_force_track_when_critical` — Master Bathroom Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_master_bedroom_force_track_when_critical` — Master Bedroom Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_music_room_force_track_when_critical` — Music Room Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_office_force_track_when_critical` — Office Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_only_track_selected_rooms` — Only Track Selected Rooms (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_predictive_allow_away` — Predictive Comfort While Away (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_predictive_auto_adjust` — Predictive Auto Adjust (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_predictive_comfort_mode` — Predictive Comfort Mode (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_predictive_hvac_mode_changes` — Predictive HVAC Mode Changes (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_respect_user_off` — Respect User Off (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_theater_room_force_track_when_critical` — Theater Room Force Track When Critical (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_dining_room` — Track Dining Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_guest_bathroom` — Track Guest Bathroom (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_guest_room` — Track Guest Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_gym` — Track Gym (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_kitchen` — Track Kitchen (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_living_room` — Track Living Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_master_bathroom` — Track Master Bathroom (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_master_bedroom` — Track Master Bedroom (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_music_room` — Track Music Room (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_office` — Track Office (`thermostat_contact_sensors`) | | | | | |
|  | ↳ `switch.thermostat_contact_sensors_track_theater_room` — Track Theater Room (`thermostat_contact_sensors`) | | | | | |

### `traeger` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Bear Grills** | Traeger / Traeger Grill / 02.13.03 | `upper_deck` | `a9cbf5b0a3ac0baade480a9a00e2740a` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `climate.slugify_grill_id_climate` — Grill Climate (`traeger`) | | | | | |
|  | ↳ `climate.slugify_grill_id_probe_slugify_channel` — Probe {channel} (`traeger`) | | | | | |
|  | ↳ `number.d8478fa2ad0a_number` — Cook Timer (`traeger`) | | | | | |
|  | ↳ `select.d8478fa2ad0a_custom_cook_cycle` — Custom Cook cycle (`traeger`) | | | | | |
|  | ↳ `sensor.bear_grills_bear_grills_bt_probe_bt0` — Bear Grills BT Probe BT0 (`traeger`) | | | | | |
|  | ↳ `sensor.bear_grills_bear_grills_bt_probe_bt1` — Bear Grills BT Probe BT1 (`traeger`) | | | | | |
|  | ↳ `sensor.bear_grills_probe_probe0` — Probe probe0 (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_ambient_temperature` — Ambient Temperature (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_auger_disconnect_errors` — Auger Disconnect Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_auger_overcurrent_errors` — Auger Overcurrent Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_auger_runtime` — Auger Runtime (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_auger_runtime_text` — Auger Runtime Text (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_bad_thermocouple_errors` — Bad Thermocouple Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_cook_cycles` — Cook Cycles (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_cook_timer_remaining` — Cook Timer Remaining (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_cook_timer_remaining_text` — Cook Timer Remaining Text (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_fan_disconnect_errors` — Fan Disconnect Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_fan_runtime` — Fan Runtime (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_fan_runtime_text` — Fan Runtime Text (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_firmware` — Firmware (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_grease_trap_clean_alert` — Grease Trap Clean Alert (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_grill_clean_alert` — Grill Clean Alert (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_grill_state` — Grill State (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_heating_state` — Heating State (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_hotrod_runtime` — Hotrod Runtime (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_hotrod_runtime_text` — Hotrod Runtime Text (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_igniter_disconnect_errors` — Igniter Disconnect Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_ignition_failures` — Ignition Failures (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_low_ambient_errors` — Low Ambient Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_low_temperature_errors` — Low Temperature Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_overheat_errors` — Overheat Errors (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_pellet_level` — Pellet Level (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_probe_probe0_status` — Probe probe0 status (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_runtime` — Runtime (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_runtime_text` — Runtime Text (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_wireless_rssi` — Wireless RSSI (`traeger`) | | | | | |
|  | ↳ `sensor.d8478fa2ad0a_wireless_ssid` — Wireless SSID (`traeger`) | | | | | |
|  | ↳ `switch.d8478fa2ad0a_keep_warm_enabled` — Keep Warm Enabled (`traeger`) | | | | | |
|  | ↳ `switch.d8478fa2ad0a_super_smoke_enabled` — Super Smoke Enabled (`traeger`) | | | | | |

### `unknown` (14 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Guest Room Air Purifier** | Espressif / esp32dev / 2025.12.0 (Dec 18 2025, 10:01:40) | `guest_room` | `9707bfdf74be140aac35b221c4e83adc` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.guest_room_air_purifier_filter_reset` — Filter Reset (`esphome`) | | | | | |
|  | ↳ `fan.guest_room_air_purifier_levoit_purifier` — Levoit Purifier (`esphome`) | | | | | |
|  | ↳ `select.guest_room_air_purifier_auto_mode` — Auto Mode (`esphome`) | | | | | |
|  | ↳ `select.guest_room_air_purifier_fan_mode` — Fan Mode (`esphome`) | | | | | |
|  | ↳ `sensor.guest_room_air_purifier_air_quality_index` — Air Quality Index (`esphome`) | | | | | |
|  | ↳ `sensor.guest_room_air_purifier_pm2_5` — PM2.5 (`esphome`) | | | | | |
|  | ↳ `sensor.guest_room_air_purifier_uptime` — Uptime (`esphome`) | | | | | |
|  | ↳ `sensor.guest_room_air_purifier_wifi_signal` — WiFi Signal (`esphome`) | | | | | |
|  | ↳ `switch.guest_room_air_purifier_display_lock` — Display Lock (`esphome`) | | | | | |
|  | ↳ `switch.guest_room_air_purifier_display_on` — Display On (`esphome`) | | | | | |
|  | ↳ `switch.guest_room_air_purifier_master_power` — Master Power (`esphome`) | | | | | |
| [ ] | **Living Room Air Purifier** | Espressif / esp32dev / 2025.12.0 (Dec 21 2025, 12:39:28) | `living_room` | `d2b02e533f1248de5be062b3458f9c8b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.living_room_air_purifier_filter_reset` — Filter Reset (`esphome`) | | | | | |
|  | ↳ `fan.living_room_air_purifier_levoit_purifier` — Levoit Purifier (`esphome`) | | | | | |
|  | ↳ `select.living_room_air_purifier_auto_mode` — Auto Mode (`esphome`) | | | | | |
|  | ↳ `select.living_room_air_purifier_fan_mode` — Fan Mode (`esphome`) | | | | | |
|  | ↳ `sensor.living_room_air_purifier_air_quality_index` — Air Quality Index (`esphome`) | | | | | |
|  | ↳ `sensor.living_room_air_purifier_pm2_5` — PM2.5 (`esphome`) | | | | | |
|  | ↳ `sensor.living_room_air_purifier_uptime` — Uptime (`esphome`) | | | | | |
|  | ↳ `sensor.living_room_air_purifier_wifi_signal` — WiFi Signal (`esphome`) | | | | | |
|  | ↳ `switch.living_room_air_purifier_display_lock` — Display Lock (`esphome`) | | | | | |
|  | ↳ `switch.living_room_air_purifier_display_on` — Display On (`esphome`) | | | | | |
|  | ↳ `switch.living_room_air_purifier_master_power` — Master Power (`esphome`) | | | | | |
| [ ] | **Transit Tracker 2783a0** | Eastside Urbanism / Transit Tracker / dev (ESPHome 2026.2.1) | `living_room` | `ae3271ffb58b92fb0429e26e62d0bb72` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.transit_tracker_2783a0_restart` — Restart (`esphome`) | | | | | |
|  | ↳ `light.transit_tracker_2783a0_display_brightness` — Display Brightness (`esphome`) | | | | | |
|  | ↳ `number.transit_tracker_2783a0_general_pins_count` — General Pins Count (`esphome`) | | | | | |
|  | ↳ `number.transit_tracker_2783a0_leaving_soon_threshold` — Leaving Soon Threshold (`esphome`) | | | | | |
|  | ↳ `number.transit_tracker_2783a0_page_interval` — Page Interval (`esphome`) | | | | | |
|  | ↳ `number.transit_tracker_2783a0_page_pause_duration` — Page Pause Duration (`esphome`) | | | | | |
|  | ↳ `number.transit_tracker_2783a0_pinned_rows_count` — Pinned Rows Count (`esphome`) | | | | | |
|  | ↳ `select.transit_tracker_2783a0_scroll_speed` — Scroll Speed (`esphome`) | | | | | |
|  | ↳ `sensor.transit_tracker_2783a0_uptime` — Uptime (`esphome`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_always_scroll_or_replace` — Always Scroll or Replace (`esphome`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_respect_pin_inset` — Respect Pin Inset (`esphome`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_scroll_headsigns` — Scroll Headsigns (`esphome`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_scroll_routes` — Scroll Routes (`esphome`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_uniform_headsign_end` — Uniform Headsign End (`esphome`) | | | | | |
|  | ↳ `switch.transit_tracker_2783a0_uniform_headsign_start` — Uniform Headsign Start (`esphome`) | | | | | |
|  | ↳ `update.transit_tracker_2783a0_firmware_update` — Firmware Update (`esphome`) | | | | | |
| [ ] | **LV600S Humidifier** | Espressif / esp32-c3-devkitm-1 / 2026.7.3 (2026-08-01 21:12:22 -0700) | `master_bedroom` | `249f8f9020ea11b4c195b4dca1b59437` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.lv600s_humidifier_display_state` — Display State (`esphome`) | | | | | |
|  | ↳ `binary_sensor.lv600s_humidifier_humidifying` — Humidifying (`esphome`) | | | | | |
|  | ↳ `binary_sensor.lv600s_humidifier_power_state` — Power State (`esphome`) | | | | | |
|  | ↳ `binary_sensor.lv600s_humidifier_tank_removed` — Tank Removed (`esphome`) | | | | | |
|  | ↳ `binary_sensor.lv600s_humidifier_warm_enabled` — Warm Enabled (`esphome`) | | | | | |
|  | ↳ `binary_sensor.lv600s_humidifier_water_low` — Water Low (`esphome`) | | | | | |
|  | ↳ `button.lv600s_humidifier_clear_timer` — Clear Timer (`esphome`) | | | | | |
|  | ↳ `button.lv600s_humidifier_query_status` — Query Status (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_humidity_mode_raw` — Humidity Mode Raw (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_manual_mode_mist_level` — Manual Mode Mist Level (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_manual_mode_warm_level` — Manual Mode Warm Level (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_mist_level` — Mist Level (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_sleep_mode_raw` — Sleep Mode Raw (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_target_humidity` — Target Humidity (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_timer_minutes` — Timer Minutes (`esphome`) | | | | | |
|  | ↳ `number.lv600s_humidifier_warm_level` — Warm Level (`esphome`) | | | | | |
|  | ↳ `select.lv600s_humidifier_mode` — Mode (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_container_state_raw` — Container State Raw (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_current_humidity` — Current Humidity (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_current_temperature` — Current Temperature (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_display_config_raw` — Display Config Raw (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_fog_status_raw` — Fog Status Raw (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_last_a5_ack` — Last A5 ACK (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_last_a5_frame` — Last A5 Frame (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_mcu_version` — MCU Version (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_mist_level_state` — Mist Level State (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_mode_raw` — Mode Raw (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_other_exception_raw` — Other Exception Raw (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_status_byte_14_raw` — Status Byte 14 Raw (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_target_humidity_state` — Target Humidity State (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_timer_remaining` — Timer Remaining (`esphome`) | | | | | |
|  | ↳ `sensor.lv600s_humidifier_warm_level_state` — Warm Level State (`esphome`) | | | | | |
|  | ↳ `switch.lv600s_humidifier_display` — Display (`esphome`) | | | | | |
|  | ↳ `switch.lv600s_humidifier_power` — Power (`esphome`) | | | | | |
| [ ] | **Master Bedroom Air Purifier** | Espressif / esp32dev / 2025.12.0 (Dec 18 2025, 16:02:04) | `master_bedroom` | `2ec98ebc89d96ca5a2d23c1d5ed5c1e0` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bedroom_air_purifier_filter_reset` — Filter Reset (`esphome`) | | | | | |
|  | ↳ `fan.master_bedroom_air_purifier_levoit_purifier` — Levoit Purifier (`esphome`) | | | | | |
|  | ↳ `select.master_bedroom_air_purifier_auto_mode` — Auto Mode (`esphome`) | | | | | |
|  | ↳ `select.master_bedroom_air_purifier_fan_mode` — Fan Mode (`esphome`) | | | | | |
|  | ↳ `sensor.master_bedroom_air_purifier_air_quality_index` — Air Quality Index (`esphome`) | | | | | |
|  | ↳ `sensor.master_bedroom_air_purifier_pm2_5` — PM2.5 (`esphome`) | | | | | |
|  | ↳ `sensor.master_bedroom_air_purifier_uptime` — Uptime (`esphome`) | | | | | |
|  | ↳ `sensor.master_bedroom_air_purifier_wifi_signal` — WiFi Signal (`esphome`) | | | | | |
|  | ↳ `switch.master_bedroom_air_purifier_display_lock` — Display Lock (`esphome`) | | | | | |
|  | ↳ `switch.master_bedroom_air_purifier_display_on` — Display On (`esphome`) | | | | | |
|  | ↳ `switch.master_bedroom_air_purifier_master_power` — Master Power (`esphome`) | | | | | |
| [ ] | **Music Room Air Purifier** | Espressif / esp32dev / 2025.12.0 (Dec 17 2025, 20:37:01) | `music_room` | `e203892e270043393a8272f3e860fb33` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.air_purifier_filter_reset` — Filter Reset (`esphome`) | | | | | |
|  | ↳ `fan.air_purifier_levoit_purifier` — Levoit Purifier (`esphome`) | | | | | |
|  | ↳ `select.air_purifier_auto_mode` — Auto Mode (`esphome`) | | | | | |
|  | ↳ `select.air_purifier_fan_mode` — Fan Mode (`esphome`) | | | | | |
|  | ↳ `sensor.air_purifier_air_quality_index` — Air Quality Index (`esphome`) | | | | | |
|  | ↳ `sensor.air_purifier_pm2_5` — PM2.5 (`esphome`) | | | | | |
|  | ↳ `sensor.air_purifier_uptime` — Uptime (`esphome`) | | | | | |
|  | ↳ `sensor.air_purifier_wifi_signal` — WiFi Signal (`esphome`) | | | | | |
|  | ↳ `switch.air_purifier_display_lock` — Display Lock (`esphome`) | | | | | |
|  | ↳ `switch.air_purifier_display_on` — Display On (`esphome`) | | | | | |
|  | ↳ `switch.air_purifier_master_power` — Master Power (`esphome`) | | | | | |
| [ ] | **Wake on LAN (Music Room)** | — | `music_room` | `beec8e42158b02a67cdce30a2e49b671` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.wake_on_lan_music_room` — — (`wake_on_lan`) | | | | | |
| [ ] | **Office Air Purifier** | Espressif / esp32dev / 2025.12.0 (Dec 18 2025, 13:21:10) | `office` | `c13825b644aff2a1f238997cb72cdd9c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.office_air_purifier_filter_reset` — Filter Reset (`esphome`) | | | | | |
|  | ↳ `fan.office_air_purifier_levoit_purifier` — Levoit Purifier (`esphome`) | | | | | |
|  | ↳ `select.office_air_purifier_auto_mode` — Auto Mode (`esphome`) | | | | | |
|  | ↳ `select.office_air_purifier_fan_mode` — Fan Mode (`esphome`) | | | | | |
|  | ↳ `sensor.office_air_purifier_air_quality_index` — Air Quality Index (`esphome`) | | | | | |
|  | ↳ `sensor.office_air_purifier_pm2_5` — PM2.5 (`esphome`) | | | | | |
|  | ↳ `sensor.office_air_purifier_uptime` — Uptime (`esphome`) | | | | | |
|  | ↳ `sensor.office_air_purifier_wifi_signal` — WiFi Signal (`esphome`) | | | | | |
|  | ↳ `switch.office_air_purifier_display_lock` — Display Lock (`esphome`) | | | | | |
|  | ↳ `switch.office_air_purifier_display_on` — Display On (`esphome`) | | | | | |
|  | ↳ `switch.office_air_purifier_master_power` — Master Power (`esphome`) | | | | | |
| [ ] | **Wake on LAN (Stephen's PC)** | — | `office` | `464d464203f6fca593b07267656e765c` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.wake_on_lan_60_cf_84_80_90_db` — — (`wake_on_lan`) | | | | | |
| [ ] | **Wake on LAN Steph's PC** | — | `office` | `33ce6f00a64c0e5f4eda3f6879a5a745` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.wake_on_lan_04_7c_16_8a_9b_1f` — — (`wake_on_lan`) | | | | | |
| [ ] | **HDFury VERTEX2** | HDFury / VERTEX2 / 0.47 | `theater_room` | `cf4ab1da78a7bd635c408c757165bd70` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hdfury_vertex2_issue_hotplug` — Issue hotplug (`hdfury`) | | | | | |
|  | ↳ `button.hdfury_vertex2_restart` — Restart (`hdfury`) | | | | | |
|  | ↳ `number.hdfury_vertex2_oled_fade_timer` — OLED fade timer (`hdfury`) | | | | | |
|  | ↳ `select.hdfury_vertex2_port_select_tx0` — Port select TX0 (`hdfury`) | | | | | |
|  | ↳ `select.hdfury_vertex2_port_select_tx1` — Port select TX1 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_57_audio_tx0` — Audio TX0 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_57_audio_tx1` — Audio TX1 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_57_edid_tx0` — EDID TX0 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_57_edid_tx1` — EDID TX1 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_57_input_rx0` — Input RX0 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_57_input_rx1` — Input RX1 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_audio_output` — Audio output (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_output_tx0` — Output TX0 (`hdfury`) | | | | | |
|  | ↳ `sensor.hdfury_vertex2_output_tx1` — Output TX1 (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_auto_switch_inputs` — Auto switch inputs (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_cec` — CEC (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_htpc_mode_rx0` — HTPC mode RX0 (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_htpc_mode_rx1` — HTPC mode RX1 (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_htpc_mode_rx2` — HTPC mode RX2 (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_htpc_mode_rx3` — HTPC mode RX3 (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_infrared` — Infrared (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_mute_audio_tx0` — Mute audio TX0 (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_mute_audio_tx1` — Mute audio TX1 (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_oled_display` — OLED display (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_tx0_force_5v` — TX0 force +5V (`hdfury`) | | | | | |
|  | ↳ `switch.hdfury_vertex2_tx1_force_5v` — TX1 force +5V (`hdfury`) | | | | | |
| [ ] | **Theater Room Air Purifier** | Espressif / esp32dev / 2025.12.0 (Dec 18 2025, 14:58:11) | `theater_room` | `b59bba470714c81d1db883830aae32bc` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_air_purifier_filter_reset` — Filter Reset (`esphome`) | | | | | |
|  | ↳ `fan.theater_room_air_purifier_levoit_purifier` — Levoit Purifier (`esphome`) | | | | | |
|  | ↳ `select.theater_room_air_purifier_auto_mode` — Auto Mode (`esphome`) | | | | | |
|  | ↳ `select.theater_room_air_purifier_fan_mode` — Fan Mode (`esphome`) | | | | | |
|  | ↳ `sensor.theater_room_air_purifier_air_quality_index` — Air Quality Index (`esphome`) | | | | | |
|  | ↳ `sensor.theater_room_air_purifier_pm2_5` — PM2.5 (`esphome`) | | | | | |
|  | ↳ `sensor.theater_room_air_purifier_uptime` — Uptime (`esphome`) | | | | | |
|  | ↳ `sensor.theater_room_air_purifier_wifi_signal` — WiFi Signal (`esphome`) | | | | | |
|  | ↳ `switch.theater_room_air_purifier_display_lock` — Display Lock (`esphome`) | | | | | |
|  | ↳ `switch.theater_room_air_purifier_display_on` — Display On (`esphome`) | | | | | |
|  | ↳ `switch.theater_room_air_purifier_master_power` — Master Power (`esphome`) | | | | | |
| [ ] | **Wake on LAN 50:eb:f6:81:5e:70** | — | `theater_room` | `e0f6062be0cca36f69bdf10226bdb1c4` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.wake_on_lan_50_eb_f6_81_5e_70` — — (`wake_on_lan`) | | | | | |
| [ ] | **Wake on LAN 94:6a:b0:cf:e7:54** | Yamaha Corporation / RX-A3080 / 2.16 | `theater_room` | `2e498ae844ab858dd68ca2db7d1d35e0` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `button.wake_on_lan_94_6a_b0_cf_e7_54` — — (`wake_on_lan`) | | | | | |

### `vesync` (7 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Guest Purifier** | VeSync / Core300S | `guest_room` | `0bac7cece5bba0dc90f5a6297f866c4f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `fan.guest_purifier` — — (`vesync`) | | | | | |
|  | ↳ `sensor.guest_purifier_air_quality` — Air quality (`vesync`) | | | | | |
|  | ↳ `sensor.guest_purifier_filter_lifetime` — Filter lifetime (`vesync`) | | | | | |
|  | ↳ `sensor.guest_purifier_pm2_5` — PM2.5 (`vesync`) | | | | | |
|  | ↳ `switch.guest_purifier_child_lock` — Child lock (`vesync`) | | | | | |
|  | ↳ `switch.guest_purifier_display` — Display (`vesync`) | | | | | |
|  | ↳ `update.guest_purifier_firmware` — Firmware (`vesync`) | | | | | |
| [ ] | **Living Room Purifier** | VeSync / Core400S | `living_room` | `e5071fc9630ca583012426728607e826` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `fan.living_room_purifier` — — (`vesync`) | | | | | |
|  | ↳ `sensor.living_room_purifier_air_quality` — Air quality (`vesync`) | | | | | |
|  | ↳ `sensor.living_room_purifier_filter_lifetime` — Filter lifetime (`vesync`) | | | | | |
|  | ↳ `sensor.living_room_purifier_pm2_5` — PM2.5 (`vesync`) | | | | | |
|  | ↳ `switch.living_room_purifier_child_lock` — Child lock (`vesync`) | | | | | |
|  | ↳ `switch.living_room_purifier_display` — Display (`vesync`) | | | | | |
|  | ↳ `update.living_room_purifier_firmware` — Firmware (`vesync`) | | | | | |
| [ ] | **Bedroom Purifier** | VeSync / Core300S | `master_bedroom` | `a688f68ff36def7f65c6da5782d018f3` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `fan.bedroom_purifier` — — (`vesync`) | | | | | |
|  | ↳ `sensor.bedroom_purifier_air_quality` — Air quality (`vesync`) | | | | | |
|  | ↳ `sensor.bedroom_purifier_filter_lifetime` — Filter lifetime (`vesync`) | | | | | |
|  | ↳ `sensor.bedroom_purifier_pm2_5` — PM2.5 (`vesync`) | | | | | |
|  | ↳ `switch.bedroom_purifier_child_lock` — Child lock (`vesync`) | | | | | |
|  | ↳ `switch.bedroom_purifier_display` — Display (`vesync`) | | | | | |
|  | ↳ `update.bedroom_purifier_firmware` — Firmware (`vesync`) | | | | | |
| [ ] | **Master Bedroom Humidifier** | VeSync / Dual200S / 1.0.11 | `master_bedroom` | `f5cc25f532b9a3aaa13937c6e1af8540` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_humidifier_low_water` — Low water (`vesync`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_humidifier_water_tank_lifted` — Water tank lifted (`vesync`) | | | | | |
|  | ↳ `humidifier.master_bedroom_humidifier` — — (`vesync`) | | | | | |
|  | ↳ `number.master_bedroom_humidifier_mist_level` — Mist level (`vesync`) | | | | | |
|  | ↳ `sensor.master_bedroom_humidifier_humidity` — Humidity (`vesync`) | | | | | |
|  | ↳ `switch.master_bedroom_humidifier_auto_off` — Auto Off (`vesync`) | | | | | |
|  | ↳ `switch.master_bedroom_humidifier_display` — Display (`vesync`) | | | | | |
|  | ↳ `update.master_bedroom_humidifier_firmware` — Firmware (`vesync`) | | | | | |
| [ ] | **Music Room Purifier** | VeSync / Core300S | `music_room` | `4e4871c135dac695d66b733556e593eb` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `fan.music_room_purifier` — — (`vesync`) | | | | | |
|  | ↳ `sensor.music_room_purifier_air_quality` — Air quality (`vesync`) | | | | | |
|  | ↳ `sensor.music_room_purifier_filter_lifetime` — Filter lifetime (`vesync`) | | | | | |
|  | ↳ `sensor.music_room_purifier_pm2_5` — PM2.5 (`vesync`) | | | | | |
|  | ↳ `switch.music_room_purifier_child_lock` — Child lock (`vesync`) | | | | | |
|  | ↳ `switch.music_room_purifier_display` — Display (`vesync`) | | | | | |
|  | ↳ `update.music_room_purifier_firmware` — Firmware (`vesync`) | | | | | |
| [ ] | **Office Purifier** | VeSync / Core300S | `office` | `dd6a29364b30764a995daf2e84f105c8` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `fan.office_purifier` — — (`vesync`) | | | | | |
|  | ↳ `sensor.office_purifier_air_quality` — Air quality (`vesync`) | | | | | |
|  | ↳ `sensor.office_purifier_filter_lifetime` — Filter lifetime (`vesync`) | | | | | |
|  | ↳ `sensor.office_purifier_pm2_5` — PM2.5 (`vesync`) | | | | | |
|  | ↳ `switch.office_purifier_child_lock` — Child lock (`vesync`) | | | | | |
|  | ↳ `switch.office_purifier_display` — Display (`vesync`) | | | | | |
|  | ↳ `update.office_purifier_firmware` — Firmware (`vesync`) | | | | | |
| [ ] | **Theater Purifier** | VeSync / Core300S | `theater_room` | `ff0ac41a84c0b650a0a71b0f2c6f1915` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `fan.theater_purifier` — — (`vesync`) | | | | | |
|  | ↳ `sensor.theater_purifier_air_quality` — Air quality (`vesync`) | | | | | |
|  | ↳ `sensor.theater_purifier_filter_lifetime` — Filter lifetime (`vesync`) | | | | | |
|  | ↳ `sensor.theater_purifier_pm2_5` — PM2.5 (`vesync`) | | | | | |
|  | ↳ `switch.theater_purifier_child_lock` — Child lock (`vesync`) | | | | | |
|  | ↳ `switch.theater_purifier_display` — Display (`vesync`) | | | | | |
|  | ↳ `update.theater_purifier_firmware` — Firmware (`vesync`) | | | | | |

### `wake_light` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Master Bedroom** | Wake Light / Room profile | `—` | `52b3a8697893bd4958a99bf636be85e3` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.master_bedroom_wake_light` — Wake Light (`wake_light`) | | | | | |

### `webostv` (1 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Living Room TV** | LG / OLED65C9PUA / 05.50.00 | `living_room` | `c71ede0d5376b94b169d862792de679b` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.living_room_tv` — — (`webostv`) | | | | | |
|  | ↳ `switch.living_room_living_room_tv_screen` — Screen (`webostv`) | | | | | |

### `xbox` (2 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **SFenton3676** | Microsoft / Xbox Network | `—` | `1b6d9575d880a770d0a0f8dd4b6868cb` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.sfenton3676` — — (`xbox`) | | | | | |
|  | ↳ `binary_sensor.sfenton3676_in_game` — In game (`xbox`) | | | | | |
|  | ↳ `binary_sensor.sfenton3676_subscribed_to_xbox_game_pass` — Subscribed to Xbox Game Pass (`xbox`) | | | | | |
|  | ↳ `image.sfenton3676_avatar` — Avatar (`xbox`) | | | | | |
|  | ↳ `image.sfenton3676_gamerpic` — Gamerpic (`xbox`) | | | | | |
|  | ↳ `image.sfenton3676_now_playing` — [%key:component::xbox::entity::sensor::now_playing::name%] (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_follower` — Follower (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_following` — Following (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_friends` — Friends (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_gamerscore` — Gamerscore (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_in_party` — In party (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_last_online` — Last online (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_now_playing` — Now playing (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_party_join_restrictions` — Party join restrictions (`xbox`) | | | | | |
|  | ↳ `sensor.sfenton3676_status` — Status (`xbox`) | | | | | |
| [ ] | **Xbox** | Microsoft / Xbox Series X | `—` | `50c9de3d44faf469e24dd27cc29d9298` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.xbox` — — (`xbox`) | | | | | |
|  | ↳ `remote.xbox` — — (`xbox`) | | | | | |
|  | ↳ `sensor.xbox_free_space_internal_storage` — Free space - Internal storage (`xbox`) | | | | | |
|  | ↳ `sensor.xbox_total_space_internal_storage` — Total space - Internal storage (`xbox`) | | | | | |

### `yamaha_musiccast` (4 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **HDMI 2** | Yamaha Corporation / RX-A3080 / 2.16 | `theater_room` | `0617759b4e0a15372cea98da178b2274` | `f2d61aa3dc119d181704958804e6ca1f` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.theater_zone2` — Theater zone2 (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.tone_control_bass_2` — Tone Control Bass (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.tone_control_treble_2` — Tone Control Treble (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.link_control_2` — Link Control (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.sleep_timer_2` — Sleep Timer (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.tone_control_mode_2` — Tone Control Mode (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.enhancer_2` — Enhancer (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.extra_bass_2` — Extra Bass (`yamaha_musiccast`) | | | | | |
| [ ] | **Room** | Yamaha Corporation / RX-A3080 / 2.16 | `theater_room` | `56362e145e58908ffbeec7cb6a419ae2` | `f2d61aa3dc119d181704958804e6ca1f` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.theater_zone3` — Theater zone3 (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.tone_control_bass_3` — Tone Control Bass (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.tone_control_treble_3` — Tone Control Treble (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.sleep_timer_3` — Sleep Timer (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.tone_control_mode_3` — Tone Control Mode (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.enhancer_3` — Enhancer (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.extra_bass_3` — Extra Bass (`yamaha_musiccast`) | | | | | |
| [ ] | **Room** | Yamaha Corporation / RX-A3080 / 2.16 | `theater_room` | `8cf4e6334eb6df5bc55f61930437542e` | `f2d61aa3dc119d181704958804e6ca1f` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.theater_zone4` — Theater zone4 (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.sleep_timer_4` — Sleep Timer (`yamaha_musiccast`) | | | | | |
| [ ] | **Theater** | Yamaha Corporation / RX-A3080 / 2.16 | `theater_room` | `f2d61aa3dc119d181704958804e6ca1f` | `—` | `—` |
|  | _Entities_ | | | | | |
|  | ↳ `media_player.theater` — — (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.dialogue_level` — Dialogue Level (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.dialogue_lift` — Dialogue Lift (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.dts_dialogue_control` — DTS Dialogue Control (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.subwoofer_volume` — Subwoofer Volume (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.tone_control_bass` — Tone Control Bass (`yamaha_musiccast`) | | | | | |
|  | ↳ `number.tone_control_treble` — Tone Control Treble (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.link_audio_delay` — Link Audio Delay (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.link_control` — Link Control (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.sleep_timer` — Sleep Timer (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.surround_decoder_device` — Surround Decoder Device (`yamaha_musiccast`) | | | | | |
|  | ↳ `select.tone_control_mode` — Tone Control Mode (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.adaptive_drc` — Adaptive DRC (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.enhancer` — Enhancer (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.extra_bass` — Extra Bass (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.party_mode` — Party Mode (`yamaha_musiccast`) | | | | | |
|  | ↳ `switch.pure_direct` — Pure Direct (`yamaha_musiccast`) | | | | | |

### `zigbee2mqtt` (147 devices)

| Done | Device | Manufacturer / model | Area | Device ID | Via device | IEEE / identifier |
|---|---|---|---|---|---|---|
| [ ] | **Dining Room Dimmer Switch** | Aqara / Dimmer Switch H2 US | `dining_room` | `f7651aef8dcfdb113ad33badf02c1f01` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013502ab` |
|  | _Entities_ | | | | | |
|  | ↳ `event.dining_room_dimmer_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `light.dining_room_dimmer_switch` — — (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_dimmer_switch_max_brightness` — Max brightness (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_dimmer_switch_min_brightness` — Min brightness (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_dimmer_switch_operation_mode_bright` — Operation mode bright (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_dimmer_switch_operation_mode_dim` — Operation mode dim (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_dimmer_switch_operation_mode_power` — Operation mode power (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_dimmer_switch_phase` — Phase (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_dimmer_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013502ab_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013502ab_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_dimmer_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_dimmer_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_dimmer_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_dimmer_switch_led_indicator` — Led indicator (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_dimmer_switch_multi_click_bright` — Multi click bright (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_dimmer_switch_multi_click_dim` — Multi click dim (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_dimmer_switch_multi_click_power` — Multi click power (`mqtt`) | | | | | |
|  | ↳ `update.dining_room_dimmer_switch` — — (`mqtt`) | | | | | |
| [ ] | **Dining Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `dining_room` | `91d376fa31e05656337160f18a69e8a7` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146ca70` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.dining_room_presence_sensor_pir_detection` — Dining Room Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.dining_room_presence_sensor_presence` — Dining Room Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.dining_room_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.dining_room_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.dining_room_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.dining_room_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.dining_room_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146ca70_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146ca70_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_presence_sensor_humidity_2` — Dining Room Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_presence_sensor_illuminance` — Dining Room Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_presence_sensor_temperature_2` — Dining Room Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.dining_room_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.dining_room_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.dining_room_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Dining Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `dining_room` | `b6d3a888141430c1b44d37684eccf20a` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146ca70` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.dining_room_dining_room_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.dining_room_dining_room_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.dining_room_dining_room_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.dining_room_dining_room_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Downstairs Hallway Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `downstairs_hallway` | `fd84a9582ef611ce07edafbba7c07430` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090a9ebc` |
|  | _Entities_ | | | | | |
|  | ↳ `button.downstairs_hallway_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.downstairs_hallway_light` — Downstairs Hallway Light (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090a9ebc_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_light_power_on_behavior` — Downstairs Hallway Light Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090a9ebc_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.downstairs_hallway_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.downstairs_hallway_light` — — (`mqtt`) | | | | | |
| [ ] | **Downstairs Hallway Light Switch** | Aqara / Light Switch H2 US (double rocker) | `downstairs_hallway` | `7e0d2d3a2f4ef4efdc62bb5f6ab572bc` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df843` |
|  | _Entities_ | | | | | |
|  | ↳ `event.downstairs_hallway_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_light_switch_power_on_behavior` — Downstairs Hallway Light Switch Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df843_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df843_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_light_switch_power` — Downstairs Hallway Light Switch Power (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.downstairs_hallway_light_switch` — Downstairs Hallway Light Switch (`mqtt`) | | | | | |
| [ ] | **Downstairs Hallway Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `downstairs_hallway` | `6b3b4a2f0d12219ef2b369571265fb02` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498ab8` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.downstairs_hallway_downstairs_hallway_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_downstairs_hallway_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_downstairs_hallway_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_downstairs_hallway_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Downstairs Hallway Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `downstairs_hallway` | `e0831fdfe025115fe058d7c8d8be7fd2` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498ab8` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.downstairs_hallway_presence_sensor_pir_detection` — Downstairs Hallway Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.downstairs_hallway_presence_sensor_presence` — Downstairs Hallway Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.downstairs_hallway_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.downstairs_hallway_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.downstairs_hallway_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.downstairs_hallway_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.downstairs_hallway_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.downstairs_hallway_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498ab8_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498ab8_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_sensor_battery` — Downstairs Hallway Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_sensor_humidity_2` — Downstairs Hallway Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_sensor_illuminance` — Downstairs Hallway Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_sensor_temperature_2` — Downstairs Hallway Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.downstairs_hallway_presence_sensor_voltage` — Downstairs Hallway Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.downstairs_hallway_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.downstairs_hallway_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.downstairs_hallway_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.downstairs_hallway_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Downstairs Hallway Light Switch** | Aqara / Light Switch H2 US (double rocker) | `downstairs_hallway` | `17545061e5c78ce1c125fa111362b8b4` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df256` |
|  | _Entities_ | | | | | |
|  | ↳ `event.front_door_downstairs_hallway_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.front_door_downstairs_hallway_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.front_door_downstairs_hallway_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.front_door_downstairs_hallway_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df256_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df256_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_downstairs_hallway_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_downstairs_hallway_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_downstairs_hallway_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_downstairs_hallway_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_downstairs_hallway_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_downstairs_hallway_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_downstairs_hallway_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.front_door_downstairs_hallway_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `entryway` | `b4e0299e13cad20daed75f72871b688c` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae274` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.front_door_presence_sensor_pir_detection` — Front Door Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.front_door_presence_sensor_presence` — Front Door Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.front_door_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.front_door_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.front_door_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.front_door_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.front_door_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.front_door_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.front_door_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.front_door_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.front_door_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.front_door_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.front_door_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.front_door_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae274_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae274_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_presence_sensor_humidity_2` — Front Door Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_presence_sensor_illuminance` — Front Door Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_presence_sensor_temperature_2` — Front Door Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.front_door_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.front_door_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.front_door_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `entryway` | `a3c13fa989147df463bf794924e5b077` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae274` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.entryway_front_door_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.entryway_front_door_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.entryway_front_door_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.entryway_front_door_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Hallway/Entryway/Living Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `entryway` | `0a51f0fc6294745cbc2c24fffd2cfa13` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f60f` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.entryway_presence_sensor_pir_detection` — Hallway/Entryway/Living Room Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.entryway_presence_sensor_presence` — Hallway/Entryway/Living Room Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.entryway_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.entryway_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.entryway_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.entryway_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.entryway_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.entryway_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.entryway_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.entryway_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.entryway_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.entryway_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.entryway_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.entryway_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f60f_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f60f_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.entryway_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.entryway_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.entryway_presence_sensor_humidity` — Hallway/Entryway/Living Room Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.entryway_presence_sensor_illuminance` — Hallway/Entryway/Living Room Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.entryway_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.entryway_presence_sensor_temperature` — Hallway/Entryway/Living Room Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.entryway_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.entryway_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.entryway_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.entryway_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.entryway_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.entryway_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.entryway_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Hallway/Entryway/Living Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `entryway` | `8afa4d4f9f626de4610d66dfebba1041` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f60f` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.entryway_hallway_entryway_living_room_presence_sensor_entryway_presence_sensor_humidity_real_last_changed` — Entryway Presence Sensor Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.entryway_hallway_entryway_living_room_presence_sensor_entryway_presence_sensor_pir_detection_real_last_changed` — Entryway Presence Sensor Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.entryway_hallway_entryway_living_room_presence_sensor_entryway_presence_sensor_presence_real_last_changed` — Entryway Presence Sensor Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.entryway_hallway_entryway_living_room_presence_sensor_entryway_presence_sensor_temperature_real_last_changed` — Entryway Presence Sensor Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Front Door Exterior Light Switch** | Aqara / Light Switch H2 US (double rocker) | `front_yard` | `8bd0b66ac26b3826ce8a90474875115f` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df32c` |
|  | _Entities_ | | | | | |
|  | ↳ `event.front_door_exterior_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.front_door_exterior_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.front_door_exterior_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.front_door_exterior_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df32c_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df32c_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_exterior_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_exterior_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_exterior_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_exterior_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_exterior_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_exterior_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_exterior_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.front_door_exterior_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Exterior Light Switch** | Aqara / Light Switch H2 US (double rocker) | `front_yard` | `e532a595be9612bff5d15de4d20b1fe1` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df32c` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.front_door_exterior_light_switch` — — (`real_last_changed`) | | | | | |
| [ ] | **Dryer Vibration Sensor** | Third Reality / Zigbee vibration sensor / v1.00.55 | `garage` | `4056c54cb2140e18eed72cbaa32933e4` | `bbbd69786881ac0790e69dba1e7b26f0` | `0xffffb40e06038e23` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.thirdreality_vibration_sensor_dryer_vibration` — Vibration (`mqtt`) | | | | | |
|  | ↳ `number.thirdreality_vibration_sensor_dryer_cool_down_time` — Cool down time (`mqtt`) | | | | | |
|  | ↳ `sensor.0xffffb40e06038e23_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_dryer_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_dryer_x_axis` — X axis (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_dryer_y_axis` — Y axis (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_dryer_z_axis` — Z axis (`mqtt`) | | | | | |
|  | ↳ `update.thirdreality_vibration_sensor_dryer` — — (`mqtt`) | | | | | |
| [ ] | **Washing Machine Vibration Sensor** | Third Reality / Zigbee vibration sensor / v1.00.55 | `garage` | `afd77cd3cbcbff186a801355088f73ef` | `bbbd69786881ac0790e69dba1e7b26f0` | `0xffffb40e060394da` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.thirdreality_vibration_sensor_washer_vibration` — Vibration (`mqtt`) | | | | | |
|  | ↳ `number.thirdreality_vibration_sensor_washer_cool_down_time` — Cool down time (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_washer_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_washer_x_axis` — X axis (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_washer_y_axis` — Y axis (`mqtt`) | | | | | |
|  | ↳ `sensor.thirdreality_vibration_sensor_washer_z_axis` — Z axis (`mqtt`) | | | | | |
|  | ↳ `update.thirdreality_vibration_sensor_washer` — — (`mqtt`) | | | | | |
| [ ] | **Guest Bathroom Entry Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_bathroom` | `a4906f3ee7ba9304b2324a17f43678e4` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014aea57` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_bathroom_entry_presence_sensor_pir_detection` — Guest Bathroom Entry Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.guest_bathroom_entry_presence_sensor_presence` — Guest Bathroom Entry Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_entry_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_entry_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_entry_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_entry_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_entry_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_entry_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_entry_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_entry_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_entry_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_entry_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_entry_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_entry_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014aea57_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014aea57_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_entry_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_entry_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_entry_presence_sensor_humidity_2` — Guest Bathroom Entry Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_entry_presence_sensor_illuminance` — Guest Bathroom Entry Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_entry_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_entry_presence_sensor_temperature_2` — Guest Bathroom Entry Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_entry_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_entry_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_entry_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_entry_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.guest_bathroom_entry_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.guest_bathroom_entry_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.guest_bathroom_entry_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Guest Bathroom Entry Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_bathroom` | `35f699f5ce2a8689f21310f3a9bbc92e` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014aea57` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_entry_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_entry_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_entry_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_entry_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Guest Bathroom Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_bathroom` | `d1fb4a518dfd8f82daed4ccda70ea4c6` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f0dd` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_bathroom_presence_sensor_pir_detection` — Guest Bathroom Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.guest_bathroom_presence_sensor_presence` — Guest Bathroom Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.guest_bathroom_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f0dd_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f0dd_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_presence_sensor_humidity_2` — Guest Bathroom Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_presence_sensor_illuminance` — Guest Bathroom Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_presence_sensor_temperature_2` — Guest Bathroom Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_shower_humidity_minimum_6h` — Guest Bathroom Shower Humidity Minimum 6h (`statistics`) | | | | | |
|  | ↳ `switch.guest_bathroom_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.guest_bathroom_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.guest_bathroom_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.guest_bathroom_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Guest Bathroom Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_bathroom` | `996089fe6b29dfb8cf83c9f91a03e0a0` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f0dd` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_bathroom_guest_bathroom_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Guest Bedroom Light Switch** | Aqara / Light Switch H2 US (double rocker) | `guest_room` | `41a0012f4174eabece78a194415ceb87` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012dfad1` |
|  | _Entities_ | | | | | |
|  | ↳ `event.guest_bedroom_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.guest_bedroom_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.guest_bedroom_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.guest_bedroom_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012dfad1_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012dfad1_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bedroom_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bedroom_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bedroom_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bedroom_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bedroom_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bedroom_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bedroom_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.guest_bedroom_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Guest Room Bed Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `guest_room` | `51b0d9ce77f3336c257f6cb825201d2e` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4fdd2` |
|  | _Entities_ | | | | | |
|  | ↳ `button.guest_room_bed_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.guest_room_bed_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_bed_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4fdd2_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_bed_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4fdd2_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.guest_room_bed_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.guest_room_bed_light` — — (`mqtt`) | | | | | |
| [ ] | **Guest Room Closet Facing Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_room` | `f1935631bbc47a0d0b283368d4f0b246` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001497be3` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_room_closet_facing_presence_sensor_pir_detection` — Guest Room Closet Facing Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.guest_room_closet_facing_presence_sensor_presence` — Guest Room Closet Facing Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_closet_facing_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_closet_facing_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_closet_facing_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_closet_facing_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_closet_facing_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_closet_facing_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_closet_facing_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_closet_facing_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_closet_facing_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_closet_facing_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_closet_facing_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_closet_facing_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001497be3_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001497be3_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_closet_facing_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_closet_facing_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_closet_facing_presence_sensor_humidity_2` — Guest Room Closet Facing Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_closet_facing_presence_sensor_illuminance` — Guest Room Closet Facing Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_closet_facing_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_closet_facing_presence_sensor_temperature_2` — Guest Room Closet Facing Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_closet_facing_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.guest_room_closet_facing_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.guest_room_closet_facing_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.guest_room_closet_facing_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.guest_room_closet_facing_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.guest_room_closet_facing_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.guest_room_closet_facing_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Guest Room Closet Facing Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_room` | `52269ea1ba44314cfdd96fe5b4edffe4` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001497be3` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.guest_room_guest_room_closet_facing_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_room_guest_room_closet_facing_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_room_guest_room_closet_facing_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_room_guest_room_closet_facing_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Guest Room Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `guest_room` | `c185fb635e19ed994a8d192192852a81` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Guest Room Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.guest_room` — — (`mqtt`) | | | | | |
| [ ] | **Guest Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_room` | `ec2006bd701efc7559ab64bdf3f9a301` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146e2e2` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_room_presence_sensor_pir_detection` — Guest Room Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.guest_room_presence_sensor_presence` — Guest Room Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146e2e2_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146e2e2_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_presence_sensor_humidity_2` — Guest Room Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_presence_sensor_illuminance` — Guest Room Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_presence_sensor_temperature_2` — Guest Room Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.guest_room_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.guest_room_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.guest_room_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.guest_room_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.guest_room_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.guest_room_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Guest Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `guest_room` | `87de5c18340e5dd93729dd0bc668cb8c` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146e2e2` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.guest_room_guest_room_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_room_guest_room_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_room_guest_room_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.guest_room_guest_room_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Guest Room TV Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `guest_room` | `1daf60521b1dfb5011c699bfa59ff1f1` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4f047` |
|  | _Entities_ | | | | | |
|  | ↳ `button.guest_room_tv_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.guest_room_tv_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.guest_room_tv_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4f047_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.guest_room_tv_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4f047_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.guest_room_tv_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.guest_room_tv_light` — — (`mqtt`) | | | | | |
| [ ] | **Guest Room Window Contact Sensor** | Aqara / Door and window sensor / 3000-0001 | `guest_room` | `10439e5c9dedbe6df65af47b7565b978` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbafc8b` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.guest_room_window_contact_sensor_contact` — Guest Room Window (`mqtt`) | | | | | |
|  | ↳ `button.guest_room_window_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbafc8b_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbafc8b_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbafc8b_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_window_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_window_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_room_window_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Gym Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `gym` | `a06d8f7be9b6b283c2ed6825ad5700cf` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa592` |
|  | _Entities_ | | | | | |
|  | ↳ `button.gym_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.gym_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.gym_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa592_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.gym_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa592_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.gym_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.gym_light` — — (`mqtt`) | | | | | |
| [ ] | **Gym Light Switch** | Aqara / Light Switch H2 US (double rocker) | `gym` | `0262ce7441ec4f05497690a5ab065e23` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df7ca` |
|  | _Entities_ | | | | | |
|  | ↳ `event.gym_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.gym_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.gym_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.gym_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df7ca_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df7ca_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.gym_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.gym_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.gym_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.gym_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.gym_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.gym_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Gym Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `gym` | `40f5fa86982b425597d2e4fd64ebc16e` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146b48d` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.gym_presence_sensor_pir_detection` — Gym Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.gym_presence_sensor_presence` — Gym Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.gym_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.gym_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.gym_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.gym_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.gym_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.gym_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.gym_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.gym_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.gym_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.gym_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.gym_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.gym_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146b48d_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146b48d_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_presence_sensor_humidity_2` — Gym Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_presence_sensor_illuminance` — Gym Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_presence_sensor_temperature_2` — Gym Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.gym_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.gym_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.gym_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.gym_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.gym_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.gym_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Gym Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `gym` | `5b8176b58440928802a373f275219702` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146b48d` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.gym_gym_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.gym_gym_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.gym_gym_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.gym_gym_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Hallway (Guest/Bath/Gym) Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `hallway` | `241c328bb5d53718b5020d4aeee71cd3` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146dc08` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.hallway_guest_bath_gym_presence_sensor_pir_detection` — Hallway (Guest/Bath/Gym) Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.hallway_guest_bath_gym_presence_sensor_presence` — Hallway (Guest/Bath/Gym) Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.hallway_guest_bath_gym_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.hallway_guest_bath_gym_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.hallway_guest_bath_gym_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.hallway_guest_bath_gym_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_bath_gym_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_bath_gym_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_bath_gym_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_bath_gym_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_bath_gym_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_bath_gym_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_bath_gym_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_bath_gym_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146dc08_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146dc08_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_guest_bath_gym_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_guest_bath_gym_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_guest_bath_gym_presence_sensor_humidity` — Hallway (Guest/Bath/Gym) Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_guest_bath_gym_presence_sensor_illuminance` — Hallway (Guest/Bath/Gym) Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_guest_bath_gym_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_guest_bath_gym_presence_sensor_temperature` — Hallway (Guest/Bath/Gym) Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_guest_bath_gym_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_guest_bath_gym_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_guest_bath_gym_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_guest_bath_gym_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.hallway_guest_bath_gym_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.hallway_guest_bath_gym_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.hallway_guest_bath_gym_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Hallway (Guest/Bath/Gym) Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `hallway` | `81a5896b772396bc995ec93acd600625` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146dc08` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.hallway_hallway_guest_bath_gym_presence_sensor_hallway_guest_bath_gym_presence_sensor_humidity_real_last_changed` — Hallway Guest Bath Gym Presence Sensor Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.hallway_hallway_guest_bath_gym_presence_sensor_hallway_guest_bath_gym_presence_sensor_pir_detection_real_last_changed` — Hallway Guest Bath Gym Presence Sensor Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.hallway_hallway_guest_bath_gym_presence_sensor_hallway_guest_bath_gym_presence_sensor_presence_real_last_changed` — Hallway Guest Bath Gym Presence Sensor Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.hallway_hallway_guest_bath_gym_presence_sensor_hallway_guest_bath_gym_presence_sensor_temperature_real_last_changed` — Hallway Guest Bath Gym Presence Sensor Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Hallway (Office/Bedroom) Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `hallway` | `d41d9560d278adabe1a41902ad078079` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146ca84` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.hallway_office_bedroom_presence_sensor_pir_detection` — Hallway (Office/Bedroom) Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.hallway_office_bedroom_presence_sensor_presence` — Hallway (Office/Bedroom) Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.hallway_office_bedroom_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.hallway_office_bedroom_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.hallway_office_bedroom_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.hallway_office_bedroom_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_bedroom_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_bedroom_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_bedroom_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_bedroom_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_bedroom_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_bedroom_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_bedroom_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_bedroom_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146ca84_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146ca84_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_office_bedroom_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_office_bedroom_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_office_bedroom_presence_sensor_humidity` — Hallway (Office/Bedroom) Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_office_bedroom_presence_sensor_illuminance` — Hallway (Office/Bedroom) Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_office_bedroom_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_office_bedroom_presence_sensor_temperature` — Hallway (Office/Bedroom) Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_office_bedroom_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_office_bedroom_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_office_bedroom_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_office_bedroom_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.hallway_office_bedroom_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.hallway_office_bedroom_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.hallway_office_bedroom_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Hallway (Office/Bedroom) Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `hallway` | `f8becc9ab493ac6c74d183ff1d5122c3` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146ca84` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.hallway_hallway_office_bedroom_presence_sensor_hallway_office_bedroom_presence_sensor_humidity_real_last_changed` — Hallway Office Bedroom Presence Sensor Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.hallway_hallway_office_bedroom_presence_sensor_hallway_office_bedroom_presence_sensor_pir_detection_real_last_changed` — Hallway Office Bedroom Presence Sensor Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.hallway_hallway_office_bedroom_presence_sensor_hallway_office_bedroom_presence_sensor_presence_real_last_changed` — Hallway Office Bedroom Presence Sensor Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.hallway_hallway_office_bedroom_presence_sensor_hallway_office_bedroom_presence_sensor_temperature_real_last_changed` — Hallway Office Bedroom Presence Sensor Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Hallway Entry Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `hallway` | `c456a10b0ab19069544083946e9b28c4` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa5ff` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hallway_entry_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.hallway_entry_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.hallway_entry_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa5ff_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.hallway_entry_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa5ff_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.hallway_entry_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.hallway_entry_light` — — (`mqtt`) | | | | | |
| [ ] | **Hallway Guest Room Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `hallway` | `88bf15737129650213efef0375c932c2` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa587` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hallway_guest_room_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.hallway_guest_room_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.hallway_guest_room_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa587_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.hallway_guest_room_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa587_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.hallway_guest_room_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.hallway_guest_room_light` — — (`mqtt`) | | | | | |
| [ ] | **Hallway Gym Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `hallway` | `2faf99af6e00842536f6819184b19f6d` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa066` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hallway_gym_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.hallway_gym_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.hallway_gym_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa066_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.hallway_gym_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa066_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.hallway_gym_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.hallway_gym_light` — — (`mqtt`) | | | | | |
| [ ] | **Hallway Light Switch** | Aqara / Light Switch H2 US (double rocker) | `hallway` | `c880d21493b84eae8346a739eb130afd` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013bbbf6` |
|  | _Entities_ | | | | | |
|  | ↳ `event.hallway_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.hallway_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.hallway_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.hallway_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbbf6_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbbf6_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.hallway_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.hallway_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.hallway_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Hallway Office Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `hallway` | `c8798e9f66d20d828e8376f0aa206551` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa0fb` |
|  | _Entities_ | | | | | |
|  | ↳ `button.hallway_office_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.hallway_office_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.hallway_office_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa0fb_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.hallway_office_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa0fb_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.hallway_office_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.hallway_office_light` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Counter Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `kitchen` | `ad4099f0101328ccf46e7eabd98bbc2e` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa0a2` |
|  | _Entities_ | | | | | |
|  | ↳ `button.kitchen_counter_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.kitchen_counter_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_counter_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa0a2_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_counter_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa0a2_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.kitchen_counter_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_counter_light` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Door Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `kitchen` | `956b5c967d834328504da7a377ce07b7` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa25d` |
|  | _Entities_ | | | | | |
|  | ↳ `button.kitchen_door_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.kitchen_door_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_door_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa25d_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_door_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa25d_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.kitchen_door_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_door_light` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Door Light Switch** | Aqara / Light Switch H2 US (double rocker) | `kitchen` | `889a6a27e39d018c856ab329db938936` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df1db` |
|  | _Entities_ | | | | | |
|  | ↳ `event.kitchen_door_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_door_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_door_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_door_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df1db_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df1db_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_door_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_door_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_door_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_door_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_door_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_door_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_door_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_door_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Entry Light Switch** | Aqara / Light Switch H2 US (double rocker) | `kitchen` | `9f148eb8e53d5f3e3cf925f13ba02302` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df75b` |
|  | _Entities_ | | | | | |
|  | ↳ `event.kitchen_entry_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_entry_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_entry_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_entry_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df75b_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df75b_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_entry_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_entry_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_entry_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_entry_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_entry_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_entry_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_entry_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_entry_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `kitchen` | `6a45807710410b7cfef817e877c36b2a` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Kitchen Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.kitchen` — Kitchen Lights (`mqtt`) | | | | | |
| [ ] | **Kitchen Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `kitchen` | `4050a38438b46c21069b601919712bdc` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f067` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.kitchen_presence_sensor_pir_detection` — Kitchen Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.kitchen_presence_sensor_presence` — Kitchen Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.kitchen_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.kitchen_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.kitchen_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.kitchen_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f067_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f067_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_presence_sensor_humidity_2` — Kitchen Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_presence_sensor_illuminance` — Kitchen Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_presence_sensor_temperature_2` — Kitchen Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.kitchen_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.kitchen_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `kitchen` | `4eb499bbb0f29acdcc9bb8316b827ae5` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f067` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.kitchen_kitchen_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.kitchen_kitchen_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.kitchen_kitchen_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.kitchen_kitchen_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Kitchen Sink Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `kitchen` | `fc07ff32b2b077329246f0dffa54100c` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa46b` |
|  | _Entities_ | | | | | |
|  | ↳ `button.kitchen_sink_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.kitchen_sink_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_sink_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa46b_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_sink_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa46b_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.kitchen_sink_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_sink_light` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Stove Light Switch** | Aqara / Light Switch H2 US (double rocker) | `kitchen` | `11e483fd9e87659d18484a198e462f48` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012dfb03` |
|  | _Entities_ | | | | | |
|  | ↳ `event.kitchen_stove_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_stove_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_stove_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_stove_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012dfb03_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012dfb03_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_stove_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_stove_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_stove_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_stove_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_stove_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_stove_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.kitchen_stove_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_stove_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Kitchen Table Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `kitchen` | `b83e6ee995fa7d501686514f7aaf49ec` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa49c` |
|  | _Entities_ | | | | | |
|  | ↳ `button.kitchen_table_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.kitchen_table_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.kitchen_table_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa49c_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.kitchen_table_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa49c_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.kitchen_table_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.kitchen_table_light` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Back Left Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `living_room` | `741880ec0bf0d10f6646bcebeb5b0418` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4fcf9` |
|  | _Entities_ | | | | | |
|  | ↳ `button.living_room_back_left_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.living_room_back_left_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.living_room_back_left_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4fcf9_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.living_room_back_left_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4fcf9_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.living_room_back_left_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.living_room_back_left_light` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Back Right Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `living_room` | `778d8f311182c1f2009e8681f8c08363` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4f329` |
|  | _Entities_ | | | | | |
|  | ↳ `button.living_room_back_right_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.living_room_back_right_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.living_room_back_right_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4f329_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.living_room_back_right_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4f329_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.living_room_back_right_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.living_room_back_right_light` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Bar Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `living_room` | `e3f0c78036ed75f945ff90eb2740c252` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100149ab20` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_bar_presence_sensor_pir_detection` — Living Room Bar Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.living_room_bar_presence_sensor_presence` — Living Room Bar Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.living_room_bar_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.living_room_bar_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.living_room_bar_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.living_room_bar_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_bar_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.living_room_bar_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_bar_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_bar_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_bar_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.living_room_bar_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.living_room_bar_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_bar_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_humidity_2` — Living Room Bar Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_illuminance` — Living Room Bar Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_temperature_2` — Living Room Bar Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_bar_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_bar_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_bar_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_bar_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.living_room_bar_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.living_room_bar_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.living_room_bar_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Bar Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `living_room` | `bdc65f0c89c2f9f100b61cbd98b210d8` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100149ab20` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.living_room_living_room_bar_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_bar_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_bar_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_bar_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Living Room Fireplace Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `living_room` | `cb9d9d694ceb3ab369580641596b08a2` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae496` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_fireplace_presence_sensor_pir_detection` — Living Room Fireplace Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.living_room_fireplace_presence_sensor_presence` — Living Room Fireplace Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.living_room_fireplace_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.living_room_fireplace_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.living_room_fireplace_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.living_room_fireplace_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_fireplace_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.living_room_fireplace_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_fireplace_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_fireplace_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_fireplace_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.living_room_fireplace_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.living_room_fireplace_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_fireplace_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae496_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae496_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_fireplace_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_fireplace_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_fireplace_presence_sensor_humidity_2` — Living Room Fireplace Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_fireplace_presence_sensor_illuminance` — Living Room Fireplace Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_fireplace_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_fireplace_presence_sensor_temperature_2` — Living Room Fireplace Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_fireplace_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_fireplace_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_fireplace_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_fireplace_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.living_room_fireplace_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.living_room_fireplace_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.living_room_fireplace_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Fireplace Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `living_room` | `90fba3a0a2c624cf4fb798e4d0d0ab2b` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae496` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.living_room_living_room_fireplace_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_fireplace_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_fireplace_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_fireplace_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Living Room Front Left Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `living_room` | `547310e0e366e73bfe56922f38f6ce29` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4dc6d` |
|  | _Entities_ | | | | | |
|  | ↳ `button.living_room_front_left_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.living_room_front_left_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.living_room_front_left_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4dc6d_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.living_room_front_left_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4dc6d_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.living_room_front_left_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.living_room_front_left_light` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Front Right Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `living_room` | `b78fe12477c5b9697f40762f2f1647bf` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090a9f39` |
|  | _Entities_ | | | | | |
|  | ↳ `button.living_room_front_right_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.living_room_front_right_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.living_room_front_right_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090a9f39_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.living_room_front_right_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090a9f39_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.living_room_front_right_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.living_room_front_right_light` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Kitchen Wall Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `living_room` | `808bca8e8001c08e4789066f37343fb8` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001497be5` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_kitchen_wall_presence_sensor_pir_detection` — Living Room Kitchen Wall Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.living_room_kitchen_wall_presence_sensor_presence` — Living Room Kitchen Wall Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.living_room_kitchen_wall_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.living_room_kitchen_wall_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.living_room_kitchen_wall_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.living_room_kitchen_wall_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_kitchen_wall_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.living_room_kitchen_wall_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_kitchen_wall_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_kitchen_wall_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_kitchen_wall_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.living_room_kitchen_wall_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.living_room_kitchen_wall_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_kitchen_wall_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001497be5_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001497be5_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_kitchen_wall_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_kitchen_wall_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_kitchen_wall_presence_sensor_humidity_2` — Living Room Kitchen Wall Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_kitchen_wall_presence_sensor_illuminance` — Living Room Kitchen Wall Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_kitchen_wall_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_kitchen_wall_presence_sensor_temperature_2` — Living Room Kitchen Wall Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_kitchen_wall_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_kitchen_wall_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_kitchen_wall_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_kitchen_wall_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.living_room_kitchen_wall_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.living_room_kitchen_wall_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.living_room_kitchen_wall_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Kitchen Wall Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `living_room` | `ec00e0c9078651de6e990067e15cce38` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001497be5` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.living_room_living_room_kitchen_wall_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_kitchen_wall_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_kitchen_wall_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_kitchen_wall_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Living Room Light Switch** | Aqara / Light Switch H2 US (double rocker) | `living_room` | `202c5057d252bfa8a320611e1d059652` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013bbc76` |
|  | _Entities_ | | | | | |
|  | ↳ `event.living_room_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.living_room_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.living_room_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.living_room_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc76_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc76_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.living_room_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `living_room` | `89748859c585a5b6d9d832a0bbf964a9` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Living Room Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.living_room` — Living Room Lights (`mqtt`) | | | | | |
| [ ] | **Living Room Presence Sensor** | Aqara / Presence sensor FP300 | `living_room` | `5bc4d346b5770142972f63e953394436` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146b39a` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_presence_sensor_pir_detection` — Living Room Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.living_room_presence_sensor_presence` — Living Room Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.living_room_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.living_room_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.living_room_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.living_room_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.living_room_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.living_room_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.living_room_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.living_room_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.living_room_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.living_room_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146b39a_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146b39a_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_presence_sensor_humidity` — Living Room Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_presence_sensor_illuminance` — Living Room Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_presence_sensor_temperature` — Living Room Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.living_room_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.living_room_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.living_room_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.living_room_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Living Room Presence Sensor** | Aqara / Presence sensor FP300 | `living_room` | `bdf57868019270ece585492de2c0b4c9` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146b39a` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.living_room_living_room_presence_sensor_humidity_real_last_changed` — Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.living_room_living_room_presence_sensor_temperature_real_last_changed` — Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Living Room Window Contact Sensor** | Aqara / Door and window sensor / 3000-0001 | `living_room` | `bfa29ad2778e48a4070bb03d57d15565` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008b8b3338` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.living_room_window_contact_sensor_contact` — Living Room Window (`mqtt`) | | | | | |
|  | ↳ `button.living_room_window_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b3338_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b3338_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b3338_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_window_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_window_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.living_room_window_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Master Bathroom Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bathroom` | `25b4f316f386bb362425cd0ee24b28db` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f64c` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.master_bathroom_master_bathroom_presence_sensor_humidity_real_last_changed` — Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bathroom_master_bathroom_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bathroom_master_bathroom_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bathroom_master_bathroom_presence_sensor_temperature_real_last_changed` — Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Master Bathroom Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bathroom` | `c217d3182693c19114a5a2174e377e5d` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f64c` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bathroom_presence_sensor_pir_detection` — Master Bathroom Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.master_bathroom_presence_sensor_presence` — Master Bathroom Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.master_bathroom_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.master_bathroom_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.master_bathroom_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.master_bathroom_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f64c_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f64c_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_presence_sensor_battery` — Master Bathroom Presence Sensor Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_presence_sensor_humidity` — Master Bathroom Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_presence_sensor_illuminance` — Master Bathroom Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_presence_sensor_temperature` — Master Bathroom Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_presence_sensor_voltage` — Master Bathroom Presence Sensor Voltage (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_shower_humidity_minimum_4h` — Master Bathroom Shower Humidity Minimum 4h (`statistics`) | | | | | |
|  | ↳ `switch.master_bathroom_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.master_bathroom_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.master_bathroom_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.master_bathroom_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Bathroom Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `master_bedroom` | `3eaf5c800dc329a7c22d1b61fe550ac1` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4ef37` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bedroom_bathroom_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.master_bedroom_bathroom_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4ef37_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4ef37_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_bathroom_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_bathroom_light` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Bathroom Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bedroom` | `09b0c073daf84e8ff0b0dc2fb14c1f07` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae9cb` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_humidity_real_last_changed` — Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_bathroom_presence_sensor_temperature_real_last_changed` — Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Master Bedroom Bathroom Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bedroom` | `51968e81efebe0430388ca45a07343eb` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae9cb` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_bathroom_presence_sensor_pir_detection` — Master Bedroom Bathroom Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_bathroom_presence_sensor_presence` — Master Bedroom Bathroom Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bathroom_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bathroom_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bathroom_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae9cb_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae9cb_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_sensor_humidity` — Master Bedroom Bathroom Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_sensor_illuminance` — Master Bedroom Bathroom Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_sensor_temperature` — Master Bedroom Bathroom Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bathroom_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_bathroom_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_bathroom_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_bathroom_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_bathroom_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_bathroom_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_bathroom_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Bed Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bedroom` | `99b0e2369f4cefa063fafdadef13f305` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001499822` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_bed_presence_sensor_pir_detection` — Pir detection (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_bed_presence_sensor_presence` — Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bed_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bed_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bed_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_bed_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_bed_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bed_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bed_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bed_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bed_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bed_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bed_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_bed_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001499822_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001499822_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_humidity` — Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_illuminance` — Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_bed_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_bed_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_bed_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_bed_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_bed_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_bed_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Bed Presence Sensor** | — | `master_bedroom` | `0bc93d0436ba847eea17f3fa00fa98b7` | `—` | `0x54ef441001499822` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_humidity_real_last_changed` — Master Bedroom Bed Presence Sensor Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_pir_detection_real_last_changed` — Master Bedroom Bed Presence Sensor Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_presence_real_last_changed` — Master Bedroom Bed Presence Sensor Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_bed_presence_sensor_temperature_real_last_changed` — Master Bedroom Bed Presence Sensor Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Master Bedroom Closet Light** | Philips / Hue white ambiance extra bright high lumen dimmable LED smart retrofit recessed 6" downlight / 1.145.1 | `master_bedroom` | `75135decc1bc1a8b4cd8828a70f28ced` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010d6d471b` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.master_bedroom_closet_light` — — (`real_last_changed`) | | | | | |
| [ ] | **Master Bedroom Closet Light** | Philips / Hue white ambiance extra bright high lumen dimmable LED smart retrofit recessed 6" downlight / 1.163.1 | `master_bedroom` | `4606fb7f4978ede681c46b0e062b4bc5` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010d6d471b` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bedroom_closet_light_identify_2` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.master_bedroom_closet_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010d6d471b_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010d6d471b_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_closet_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_closet_light` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Closet Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bedroom` | `8d83d016d71e0ed5fdf1a7b55fd2cf86` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146eb59` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_humidity_real_last_changed` — Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_closet_presence_sensor_temperature_real_last_changed` — Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Master Bedroom Closet Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bedroom` | `8fa9a71649f683338902deba330b8675` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146eb59` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_closet_presence_sensor_pir_detection` — Master Bedroom Closet Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_closet_presence_sensor_presence` — Master Bedroom Closet Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_closet_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_closet_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_closet_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146eb59_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146eb59_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_sensor_humidity` — Master Bedroom Closet Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_sensor_illuminance` — Master Bedroom Closet Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_sensor_temperature` — Master Bedroom Closet Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_closet_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_closet_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_closet_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_closet_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_closet_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_closet_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_closet_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Door Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `master_bedroom` | `2a3b656921b8c5a01bb4b0bfcb9e2c87` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4ef1e` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bedroom_door_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.master_bedroom_door_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_door_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4ef1e_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_door_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4ef1e_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_door_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_door_light` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Light Switch** | Aqara / Light Switch H2 US (2 Buttons, 2 Channels) | `master_bedroom` | `7eebdb343d1beb83f8a2e5930b2d2fd5` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013d2c9a` |
|  | _Entities_ | | | | | |
|  | ↳ `event.master_bedroom_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_light_switch_operation_mode_down` — Operation mode down (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_light_switch_operation_mode_up` — Operation mode up (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013d2c9a_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013d2c9a_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_light_switch_down` — Down (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_light_switch_lock_relay_down` — Lock relay down (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_light_switch_lock_relay_up` — Lock relay up (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_light_switch_up` — Up (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `master_bedroom` | `b96361f7c648dd8872422eb8b5adee11` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Master Bedroom Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.master_bedroom` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Street Window Contact Sensor** | Aqara / Door and window sensor | `master_bedroom` | `680e6a56b025932bcb31672032ec8dad` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008b8b33b8` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_street_window_contact_sensor_contact` — Master Bedroom Street Window (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_street_window_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b33b8_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b33b8_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b33b8_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_street_window_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_street_window_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_street_window_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Window Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `master_bedroom` | `0a613780e8d26061e43ca9f5c2bf9ec5` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4eeee` |
|  | _Entities_ | | | | | |
|  | ↳ `button.master_bedroom_window_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.master_bedroom_window_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4eeee_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4eeee_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_window_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_window_light` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Window Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bedroom` | `d888a9d4a1b73aacb6da56604db02b3a` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f191` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.master_bedroom_window_presence_sensor_pir_detection` — Master Bedroom Window Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.master_bedroom_window_presence_sensor_presence` — Master Bedroom Window Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_window_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_window_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_window_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.master_bedroom_window_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.master_bedroom_window_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.master_bedroom_window_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f191_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146f191_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_window_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_window_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_window_presence_sensor_humidity` — Master Bedroom Window Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_window_presence_sensor_illuminance` — Master Bedroom Window Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_window_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_window_presence_sensor_temperature` — Master Bedroom Window Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bedroom_window_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_window_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_window_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.master_bedroom_window_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_window_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.master_bedroom_window_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.master_bedroom_window_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Master Bedroom Window Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `master_bedroom` | `56c1ebabee85dbb2a7d8dbecc844201b` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146f191` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_window_presence_sensor_humidity_real_last_changed` — Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_window_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_window_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.master_bedroom_master_bedroom_window_presence_sensor_temperature_real_last_changed` — Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Music Room Door Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `music_room` | `aa37de12c2a0842fa9d805c800180709` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498c47` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.music_room_music_room_door_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_door_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_door_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_door_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Music Room Door Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `music_room` | `cc7b39f90d8dbf86bc3ee4d650912d44` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498c47` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.music_room_door_presence_sensor_pir_detection` — Music Room Door Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.music_room_door_presence_sensor_presence` — Music Room Door Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.music_room_door_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.music_room_door_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.music_room_door_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.music_room_door_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_door_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.music_room_door_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.music_room_door_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.music_room_door_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.music_room_door_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.music_room_door_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.music_room_door_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.music_room_door_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498c47_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498c47_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_presence_sensor_battery` — Music Room Door Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_presence_sensor_humidity_2` — Music Room Door Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_presence_sensor_illuminance` — Music Room Door Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_presence_sensor_temperature_2` — Music Room Door Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_presence_sensor_voltage` — Music Room Door Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_door_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_door_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_door_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.music_room_door_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.music_room_door_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.music_room_door_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Music Room Kitchenette Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `music_room` | `99b6cdd2661a908fb468b6330ab6369d` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae1d0` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.music_room_music_room_kitchenette_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_kitchenette_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_kitchenette_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_kitchenette_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Music Room Kitchenette Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `music_room` | `b8eb6d59533c3165836be80f3a5f8f50` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410014ae1d0` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.music_room_kitchenette_presence_sensor_pir_detection` — Music Room Kitchenette Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.music_room_kitchenette_presence_sensor_presence` — Music Room Kitchenette Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.music_room_kitchenette_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.music_room_kitchenette_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.music_room_kitchenette_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.music_room_kitchenette_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_kitchenette_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.music_room_kitchenette_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.music_room_kitchenette_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.music_room_kitchenette_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.music_room_kitchenette_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.music_room_kitchenette_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.music_room_kitchenette_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.music_room_kitchenette_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae1d0_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410014ae1d0_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_kitchenette_presence_sensor_battery` — Music Room Kitchenette Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_kitchenette_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_kitchenette_presence_sensor_humidity_2` — Music Room Kitchenette Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_kitchenette_presence_sensor_illuminance` — Music Room Kitchenette Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_kitchenette_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_kitchenette_presence_sensor_temperature_2` — Music Room Kitchenette Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_kitchenette_presence_sensor_voltage` — Music Room Kitchenette Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_kitchenette_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_kitchenette_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_kitchenette_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.music_room_kitchenette_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.music_room_kitchenette_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.music_room_kitchenette_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Music Room North Wall Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `music_room` | `8af139296ae251b072176ebd3fcb765a` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498bde` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.music_room_music_room_north_wall_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_north_wall_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_north_wall_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.music_room_music_room_north_wall_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Music Room North Wall Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `music_room` | `34a6350792e7004133d7c23b5d06680c` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498bde` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.music_room_north_wall_presence_sensor_pir_detection` — Music Room North Wall Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.music_room_north_wall_presence_sensor_presence` — Music Room North Wall Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.music_room_north_wall_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.music_room_north_wall_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.music_room_north_wall_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.music_room_north_wall_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.music_room_north_wall_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.music_room_north_wall_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.music_room_north_wall_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.music_room_north_wall_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.music_room_north_wall_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.music_room_north_wall_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.music_room_north_wall_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.music_room_north_wall_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498bde_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498bde_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_north_wall_presence_sensor_battery` — Music Room North Wall Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_north_wall_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_north_wall_presence_sensor_humidity_2` — Music Room North Wall Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_north_wall_presence_sensor_illuminance` — Music Room North Wall Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_north_wall_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_north_wall_presence_sensor_temperature_2` — Music Room North Wall Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_north_wall_presence_sensor_voltage` — Music Room North Wall Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_north_wall_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_north_wall_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_north_wall_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.music_room_north_wall_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.music_room_north_wall_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.music_room_north_wall_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Office Closet Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `office` | `abd04a34304ccc4a2df9085a15d76d60` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498afb` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.office_office_closet_presence_sensor_humidity_real_last_changed` — Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.office_office_closet_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.office_office_closet_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.office_office_closet_presence_sensor_temperature_real_last_changed` — Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Office Closet Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `office` | `4781a380e113c0429bdb527036b81441` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498afb` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.office_closet_presence_sensor_pir_detection` — Office Closet Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.office_closet_presence_sensor_presence` — Office Closet Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.office_closet_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.office_closet_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.office_closet_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.office_closet_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.office_closet_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.office_closet_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.office_closet_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.office_closet_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.office_closet_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.office_closet_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.office_closet_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.office_closet_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498afb_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498afb_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.office_closet_presence_sensor_battery` — Office Closet Presence Sensor Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.office_closet_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.office_closet_presence_sensor_humidity` — Office Closet Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.office_closet_presence_sensor_illuminance` — Office Closet Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.office_closet_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.office_closet_presence_sensor_temperature` — Office Closet Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.office_closet_presence_sensor_voltage` — Office Closet Presence Sensor Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.office_closet_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.office_closet_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.office_closet_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.office_closet_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.office_closet_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.office_closet_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Office Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `office` | `9a3c470d93e059776fb67c3535f062c8` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880108d4f7cb` |
|  | _Entities_ | | | | | |
|  | ↳ `button.office_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.office_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.office_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880108d4f7cb_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.office_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880108d4f7cb_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.office_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.office_light` — — (`mqtt`) | | | | | |
| [ ] | **Office Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `office` | `cd6965b3e039799ea6cc559791ec2710` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146c90c` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.office_office_presence_sensor_humidity_real_last_changed` — Humidity Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.office_office_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.office_office_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.office_office_presence_sensor_temperature_real_last_changed` — Temperature Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Office Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `office` | `d1d9019c26ebc05f9ec0b966d275f583` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100146c90c` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.office_presence_sensor_pir_detection` — Office Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.office_presence_sensor_presence` — Office Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.office_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.office_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.office_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.office_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.office_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.office_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.office_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.office_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.office_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.office_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.office_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.office_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146c90c_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100146c90c_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.office_presence_sensor_battery` — Office Presence Sensor Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.office_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.office_presence_sensor_humidity` — Office Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.office_presence_sensor_illuminance` — Office Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.office_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.office_presence_sensor_temperature` — Office Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.office_presence_sensor_voltage` — Office Presence Sensor Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.office_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.office_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.office_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.office_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.office_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.office_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Door Contact Sensor** | Aqara / Door and window sensor / 3000-0001 | `theater_room` | `3cae733f1594d8dab6826fd247ab6c02` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbd4847` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.theater_room_door_contact_sensor_contact` — Theater Room Door (`mqtt`) | | | | | |
|  | ↳ `button.theater_room_door_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbd4847_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbd4847_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbd4847_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_door_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_door_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_door_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Theater Room Front Rear Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `theater_room` | `eca0a7c39cd558c1821f3adf9cc06f26` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa6c6` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_front_rear_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.theater_room_front_rear_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_front_rear_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa6c6_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_front_rear_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa6c6_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_front_rear_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_front_rear_light` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Front Right Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `theater_room` | `3061042b7c37d65236aff2524701498a` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa5d3` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_front_right_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.theater_room_front_right_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_front_right_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa5d3_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_front_right_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa5d3_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_front_right_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_front_right_light` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Front Screen Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `theater_room` | `a6fe98252bf60ce4364c36f60a7d9ff0` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa633` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_front_screen_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.theater_room_front_screen_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_front_screen_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa633_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_front_screen_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa633_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_front_screen_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_front_screen_light` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Light Switch** | Aqara / Light Switch H2 US (double rocker) | `theater_room` | `6db82e902004d79ed5c8b51f69cc6fe9` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012b2c65` |
|  | _Entities_ | | | | | |
|  | ↳ `event.theater_room_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012b2c65_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012b2c65_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `theater_room` | `03b508a8dc587a195682d4276daed5d7` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Theater Room Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.theater_room` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `theater_room` | `8235b4f77d78306ca2a350056135561f` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498b37` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.theater_room_presence_sensor_pir_detection` — Theater Room Presence Sensor Motion (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.theater_room_presence_sensor_presence` — Theater Room Presence Sensor Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.theater_room_presence_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `button.theater_room_presence_sensor_restart_device` — Restart device (`mqtt`) | | | | | |
|  | ↳ `button.theater_room_presence_sensor_spatial_learning` — Spatial learning (`mqtt`) | | | | | |
|  | ↳ `button.theater_room_presence_sensor_track_target_distance` — Track target distance (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_absence_delay_timer` — Absence delay timer (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_detection_range` — Detection range (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_humidity_reporting_interval` — Humidity reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_humidity_reporting_threshold` — Humidity reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_light_reporting_interval` — Light reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_light_reporting_threshold` — Light reporting threshold (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_light_sampling_period` — Light sampling period (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_pir_detection_interval` — Pir detection interval (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_temp_and_humidity_sampling_period` — Temp and humidity sampling period (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_temp_reporting_interval` — Temp reporting interval (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_presence_sensor_temp_reporting_threshold` — Temp reporting threshold (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_presence_sensor_humidity_report_mode` — Humidity report mode (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_presence_sensor_light_report_mode` — Light report mode (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_presence_sensor_light_sampling` — Light sampling (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_presence_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_presence_sensor_presence_detection_options` — Presence detection options (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_presence_sensor_temp_and_humidity_sampling` — Temp and humidity sampling (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_presence_sensor_temp_reporting_mode` — Temp reporting mode (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498b37_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef441001498b37_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_presence_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_presence_sensor_detection_range_composite` — Detection range composite (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_presence_sensor_humidity_2` — Theater Room Presence Sensor Humidity (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_presence_sensor_illuminance` — Theater Room Presence Sensor Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_presence_sensor_target_distance` — Target distance (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_presence_sensor_temperature_2` — Theater Room Presence Sensor Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.theater_room_presence_sensor_voltage` — Voltage (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_presence_sensor_ai_interference_source_selfidentification` — Ai interference source selfidentification (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_presence_sensor_ai_sensitivity_adaptive` — Ai sensitivity adaptive (`mqtt`) | | | | | |
|  | ↳ `switch.theater_room_presence_sensor_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_presence_sensor_schedule_end_time` — Schedule end time (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_presence_sensor_schedule_start_time` — Schedule start time (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_presence_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Presence Sensor** | Aqara / Presence sensor FP300 / 0.0.0_6542 | `theater_room` | `f44ba06a2c9b2e07f41555509de6b437` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001498b37` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.theater_room_theater_room_presence_sensor_humidity_2_real_last_changed` — Humidity 2 Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.theater_room_theater_room_presence_sensor_pir_detection_real_last_changed` — Pir Detection Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.theater_room_theater_room_presence_sensor_presence_real_last_changed` — Presence Real Last Changed (`real_last_changed`) | | | | | |
|  | ↳ `sensor.theater_room_theater_room_presence_sensor_temperature_2_real_last_changed` — Temperature 2 Real Last Changed (`real_last_changed`) | | | | | |
| [ ] | **Theater Room Rear Back Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `theater_room` | `07d44329cc206617325a6c38509245f4` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa129` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_rear_back_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.theater_room_rear_back_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_rear_back_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa129_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_rear_back_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa129_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_rear_back_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_rear_back_light` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Rear Front Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `theater_room` | `5e8ffb13a3c5f40ee17802341e898bdc` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa3a7` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_rear_front_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.theater_room_rear_front_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_rear_front_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa3a7_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_rear_front_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa3a7_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_rear_front_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_rear_front_light` — — (`mqtt`) | | | | | |
| [ ] | **Theater Room Rear Right Light** | Philips / Hue white ambiance 5/6" retrofit recessed downlight / 1.163.1 | `theater_room` | `52cd0cfe0fcd7d9692fe554d0c2f5108` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00178801090aa567` |
|  | _Entities_ | | | | | |
|  | ↳ `button.theater_room_rear_right_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.theater_room_rear_right_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.theater_room_rear_right_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x00178801090aa567_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.theater_room_rear_right_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00178801090aa567_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.theater_room_rear_right_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.theater_room_rear_right_light` — — (`mqtt`) | | | | | |
| [ ] | **Back Deck Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `upper_deck` | `4ceeb196205850269b19488a0ee1dac7` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Back Deck Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.back_deck` — Back Deck Lights (`mqtt`) | | | | | |
| [ ] | **Back Deck Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.13.0 | `upper_deck` | `e8bb5c2379228cfd5888cf981bf6082c` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Back Deck Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `sensor.back_deck_lights` — — (`real_last_changed`) | | | | | |
| [ ] | **Back Deck Motion Sensor** | Philips / Hue motion outdoor sensor / 2.85.1 | `upper_deck` | `683a11de1d439c109519a33dce6d560e` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010ebb1de7` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.back_deck_motion_sensor_occupancy` — Occupancy (`mqtt`) | | | | | |
|  | ↳ `button.back_deck_motion_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `number.back_deck_motion_sensor_occupancy_timeout` — Occupancy timeout (`mqtt`) | | | | | |
|  | ↳ `select.back_deck_motion_sensor_motion_sensitivity` — Motion sensitivity (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010ebb1de7_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.back_deck_motion_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.back_deck_motion_sensor_illuminance` — Illuminance (`mqtt`) | | | | | |
|  | ↳ `sensor.back_deck_motion_sensor_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `switch.back_deck_motion_sensor_led_indication` — Led indication (`mqtt`) | | | | | |
|  | ↳ `update.back_deck_motion_sensor` — — (`mqtt`) | | | | | |
| [ ] | **Couch Light** | Philips / Hue Discover white and color ambiance flood light / 1.163.1 | `upper_deck` | `aad0eedc8736cdae085f920f94bb4333` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880109c22fb2` |
|  | _Entities_ | | | | | |
|  | ↳ `button.couch_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.couch_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.couch_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880109c22fb2_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.couch_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880109c22fb2_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.couch_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.couch_light` — — (`mqtt`) | | | | | |
| [ ] | **Grill Light** | Philips / Hue Discover white and color ambiance flood light / 1.163.1 | `upper_deck` | `6026716535914296e5284521bcc6e3ce` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x0017880109c2305a` |
|  | _Entities_ | | | | | |
|  | ↳ `button.grill_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.grill_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.grill_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x0017880109c2305a_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.grill_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x0017880109c2305a_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.grill_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.grill_light` — — (`mqtt`) | | | | | |
| [ ] | **Dining Room Door Contact Sensor** | Aqara / Door and window sensor / 3000-0001 | `—` | `edd3cf9c8142fb2709c0ad11fbca882a` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbd5a3e` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.dining_room_door_contact_sensor_contact` — Dining Room Door (`mqtt`) | | | | | |
|  | ↳ `button.dining_room_door_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbd5a3e_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_door_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_door_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_door_contact_sensor_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_door_contact_sensor_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_door_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Dining Room Door Light Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `76d8de1e521701de9ed7e21cbcd95f70` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013bbba3` |
|  | _Entities_ | | | | | |
|  | ↳ `event.dining_room_door_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_door_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_door_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.dining_room_door_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbba3_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbba3_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_door_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.dining_room_door_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_door_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_door_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_door_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_door_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.dining_room_door_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.dining_room_door_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Bollard 1** | Philips / Hue Impress outdoor Pedestal / 1.163.1 | `—` | `3b040de3d3ff4ae3a7a4898609ee7538` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010eca6887` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_bollard_1_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_bollard_1` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_bollard_1_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010eca6887_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_bollard_1_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010eca6887_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_bollard_1_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_bollard_1` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Bollard 2** | Philips / Hue Impress outdoor Pedestal / 1.163.1 | `—` | `a931daddb0bd2f218d91f21a833188c6` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010e869f2e` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_bollard_2_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_bollard_2` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_bollard_2_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010e869f2e_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_bollard_2_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010e869f2e_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_bollard_2_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_bollard_2` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Bollard 3** | Philips / Hue Impress outdoor Pedestal / 1.163.1 | `—` | `7d3d22a73519df5c5fb746155113253f` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010e86ac07` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_bollard_3_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_bollard_3` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_bollard_3_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010e86ac07_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_bollard_3_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010e86ac07_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_bollard_3_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_bollard_3` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Bollard 4** | Philips / Hue Impress outdoor Pedestal / 1.163.1 | `—` | `f28fdfe709a4d2184a5ee22d54a11380` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010e86ac03` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_bollard_4_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_bollard_4` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_bollard_4_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010e86ac03_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_bollard_4_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010e86ac03_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_bollard_4_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_bollard_4` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Bollard 5** | Philips / Hue Impress outdoor Pedestal / 1.163.1 | `—` | `4b1a52d180292c9d730395fd9e1cc09e` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010efd29a2` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_bollard_5_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_bollard_5` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_bollard_5_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010efd29a2_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_bollard_5_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010efd29a2_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_bollard_5_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_bollard_5` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Bollard 6** | Philips / Hue Impress outdoor Pedestal / 1.163.1 | `—` | `ba34ee665c3c0ba366f241a0dea27564` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010eca686b` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_bollard_6_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_bollard_6` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_bollard_6_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010eca686b_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_bollard_6_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010eca686b_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_bollard_6_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_bollard_6` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Contact Sensor** | Aqara / Door and window sensor / 3000-0001 | `—` | `60cb28014d87f96b07fb166dffaf6abf` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbc737a` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.front_door_contact_sensor_contact` — Front Door (`mqtt`) | | | | | |
|  | ↳ `button.front_door_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbc737a_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbc737a_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbc737a_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Front Door Entryway Light Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `f04382656912be56c31c2ea59bb07848` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df8fc` |
|  | _Entities_ | | | | | |
|  | ↳ `event.front_door_entryway_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.front_door_entryway_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.front_door_entryway_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.front_door_entryway_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df8fc_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df8fc_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_entryway_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.front_door_entryway_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_entryway_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_entryway_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_entryway_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_entryway_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.front_door_entryway_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.front_door_entryway_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Exterior Left Light** | Philips / Hue outdoor Impress wall lamp / 1.163.1 | `—` | `afdc863487993f962969dc25301ac361` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010e7da311` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_exterior_left_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_exterior_left_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_exterior_left_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010e7da311_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_exterior_left_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010e7da311_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_exterior_left_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_exterior_left_light` — — (`mqtt`) | | | | | |
| [ ] | **Front Door Exterior Light V2** | Philips / Hue Impress outdoor wall light / 1.163.1 | `—` | `d3af5c347ce69d6b32711281c30afd95` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010f4ca4a6` |
|  | _Entities_ | | | | | |
|  | ↳ `button.front_door_exterior_light_v2_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.front_door_exterior_light_v2` — — (`mqtt`) | | | | | |
|  | ↳ `number.front_door_exterior_light_v2_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010f4ca4a6_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.front_door_exterior_light_v2_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010f4ca4a6_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.front_door_exterior_light_v2_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.front_door_exterior_light_v2` — — (`mqtt`) | | | | | |
| [ ] | **Front Yard Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `—` | `6a7c558959f358bed7cf682e1ffc376c` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Front Yard Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.front_yard_lights` — — (`mqtt`) | | | | | |
| [ ] | **Garage Door Contact Sensor** | Aqara / Door and window sensor / 3000-0001 | `—` | `3cb761bb31349ca668326f810da011a2` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008b8b33fa` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.garage_door_contact_sensor_contact` — Garage Door (`mqtt`) | | | | | |
|  | ↳ `button.garage_door_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b33fa_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b33fa_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008b8b33fa_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.garage_door_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.garage_door_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.garage_door_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Garage Power Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `1fd2162c7b6805a652aff9aedfc2104e` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df7fa` |
|  | _Entities_ | | | | | |
|  | ↳ `event.garage_power_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.garage_power_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.garage_power_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.garage_power_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df7fa_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df7fa_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.garage_power_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.garage_power_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.garage_power_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.garage_power_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.garage_power_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.garage_power_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.garage_power_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.garage_power_switch` — — (`mqtt`) | | | | | |
| [ ] | **Guest Bathroom Dimmer Switch** | Aqara / Dimmer Switch H2 US | `—` | `33e6cb941c69a359b023036166562d07` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef441001350348` |
|  | _Entities_ | | | | | |
|  | ↳ `event.guest_bathroom_dimmer_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `light.guest_bathroom_dimmer_switch` — — (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_dimmer_switch_max_brightness` — Max brightness (`mqtt`) | | | | | |
|  | ↳ `number.guest_bathroom_dimmer_switch_min_brightness` — Min brightness (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_dimmer_switch_operation_mode_bright` — Operation mode bright (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_dimmer_switch_operation_mode_dim` — Operation mode dim (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_dimmer_switch_operation_mode_power` — Operation mode power (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_dimmer_switch_phase` — Phase (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_dimmer_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_dimmer_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_dimmer_switch_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_dimmer_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_dimmer_switch_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_dimmer_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_dimmer_switch_led_indicator` — Led indicator (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_dimmer_switch_multi_click_bright` — Multi click bright (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_dimmer_switch_multi_click_dim` — Multi click dim (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_dimmer_switch_multi_click_power` — Multi click power (`mqtt`) | | | | | |
|  | ↳ `update.guest_bathroom_dimmer_switch` — — (`mqtt`) | | | | | |
| [ ] | **Guest Bathroom Fan Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `c4e6a6b0515d00f62fbcab4d2b6235a8` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013bbb60` |
|  | _Entities_ | | | | | |
|  | ↳ `event.guest_bathroom_fan_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_fan_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_fan_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_fan_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbb60_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbb60_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_fan_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_fan_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_fan_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_fan_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_fan_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_fan_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_fan_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.guest_bathroom_fan_switch` — — (`mqtt`) | | | | | |
| [ ] | **Guest Bathroom Towel Rack Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `5451f2ba9973da1c42786eb6d47340ce` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df4f9` |
|  | _Entities_ | | | | | |
|  | ↳ `event.guest_bathroom_towel_rack_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_towel_rack_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_towel_rack_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.guest_bathroom_towel_rack_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df4f9_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df4f9_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_towel_rack_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.guest_bathroom_towel_rack_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_towel_rack_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_towel_rack_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_towel_rack_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_towel_rack_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.guest_bathroom_towel_rack_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.guest_bathroom_towel_rack_switch` — — (`mqtt`) | | | | | |
| [ ] | **Gym Window Contact Sensor** | Aqara / Door and window sensor | `—` | `1cdecb64345f1eb9ccf0c419ee6198ae` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbafc89` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.gym_window_contact_sensor_contact` — Gym Window (`mqtt`) | | | | | |
|  | ↳ `button.gym_window_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbafc89_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_window_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_window_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_window_contact_sensor_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_window_contact_sensor_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.gym_window_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Hallway Lights** | Zigbee2MQTT / Group / Zigbee2MQTT 2.14.1 | `—` | `daeac780bb82c303f8c0e474109b92fc` | `bbbd69786881ac0790e69dba1e7b26f0` | `zigbee2mqtt/Hallway Lights/...` |
|  | _Entities_ | | | | | |
|  | ↳ `light.hallway_lights` — Hallway Lights (`mqtt`) | | | | | |
| [ ] | **Kitchen Door Contact Sensor** | Aqara / Door and window sensor | `—` | `cb3fcda267f9d401333e4e50ce6e519f` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbc739d` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.kitchen_door_contact_sensor_contact` — Kitchen Door (`mqtt`) | | | | | |
|  | ↳ `button.kitchen_door_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbc739d_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbc739d_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbc739d_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_door_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_door_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.kitchen_door_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Master Bathroom Dimmer Switch** | Aqara / Dimmer Switch H2 US | `—` | `cf81683f7ff03921b9bec046a87b0669` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef44100134cff9` |
|  | _Entities_ | | | | | |
|  | ↳ `event.master_bathroom_dimmer_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `light.master_bathroom_dimmer_switch` — — (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_dimmer_switch_max_brightness` — Max brightness (`mqtt`) | | | | | |
|  | ↳ `number.master_bathroom_dimmer_switch_min_brightness` — Min brightness (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_dimmer_switch_operation_mode_bright` — Operation mode bright (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_dimmer_switch_operation_mode_dim` — Operation mode dim (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_dimmer_switch_operation_mode_power` — Operation mode power (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_dimmer_switch_phase` — Phase (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_dimmer_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100134cff9_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef44100134cff9_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_dimmer_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_dimmer_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_dimmer_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_dimmer_switch_led_indicator` — Led indicator (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_dimmer_switch_multi_click_bright` — Multi click bright (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_dimmer_switch_multi_click_dim` — Multi click dim (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_dimmer_switch_multi_click_power` — Multi click power (`mqtt`) | | | | | |
|  | ↳ `update.master_bathroom_dimmer_switch` — — (`mqtt`) | | | | | |
| [ ] | **Master Bathroom Fan Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `8e9106ab09cfaf13894b6ec3a3739025` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df30a` |
|  | _Entities_ | | | | | |
|  | ↳ `event.master_bathroom_fan_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_fan_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_fan_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_fan_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df30a_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df30a_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_fan_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_fan_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_fan_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_fan_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_fan_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_fan_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_fan_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.master_bathroom_fan_switch` — — (`mqtt`) | | | | | |
| [ ] | **Master Bathroom Towel Rack Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `dc0c142b5a98858e486b44cf51870779` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012df2c2` |
|  | _Entities_ | | | | | |
|  | ↳ `event.master_bathroom_towel_rack_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_towel_rack_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_towel_rack_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.master_bathroom_towel_rack_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df2c2_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012df2c2_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_towel_rack_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.master_bathroom_towel_rack_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_towel_rack_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_towel_rack_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_towel_rack_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_towel_rack_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.master_bathroom_towel_rack_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.master_bathroom_towel_rack_switch` — — (`mqtt`) | | | | | |
| [ ] | **Music Room Door Contact Sensor** | Aqara / Door and window sensor | `—` | `8f09d76465e63b18320795358cadd578` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbd619b` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.music_room_door_contact_sensor_contact` — Music Room Door (`mqtt`) | | | | | |
|  | ↳ `button.music_room_door_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbd619b_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbd619b_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbd619b_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_door_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Music Room Fireplace Light Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `10092526f00a131d69aa6b8c5fb3ad08` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013bbc4f` |
|  | _Entities_ | | | | | |
|  | ↳ `event.music_room_fireplace_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.music_room_fireplace_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.music_room_fireplace_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.music_room_fireplace_light_switch_power_on_behavior` — Music Room Fireplace Light Switch Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc4f_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc4f_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_fireplace_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_fireplace_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_fireplace_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_fireplace_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_fireplace_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_fireplace_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_fireplace_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.music_room_fireplace_light_switch` — Music Room Fireplace Light Switch (`mqtt`) | | | | | |
| [ ] | **Music Room Server Light Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `95c793004c138eb365f37087d1e19e48` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013bbc4d` |
|  | _Entities_ | | | | | |
|  | ↳ `event.music_room_server_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.music_room_server_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.music_room_server_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.music_room_server_light_switch_power_on_behavior` — Music Room Server Light Switch Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc4d_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc4d_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_server_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.music_room_server_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_server_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_server_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_server_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_server_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.music_room_server_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.music_room_server_light_switch` — Music Room Server Light Switch (`mqtt`) | | | | | |
| [ ] | **Office Light Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `ee6298c7e871c6f970b01a568fe02b71` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410013bbc0e` |
|  | _Entities_ | | | | | |
|  | ↳ `event.office_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.office_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.office_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.office_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc0e_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410013bbc0e_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.office_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.office_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.office_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.office_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.office_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.office_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.office_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.office_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Office PC Window Sensor** | Aqara / Door and window sensor / 3000-0001 | `—` | `490b64b0cc92d7d0fd6af90ee48cb57f` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbacddc` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.office_pc_window_sensor_contact` — Office PC Window (`mqtt`) | | | | | |
|  | ↳ `button.office_pc_window_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbacddc_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbacddc_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbacddc_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.office_pc_window_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.office_pc_window_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.office_pc_window_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Office Window Contact Sensor** | Aqara / Door and window sensor / 3000-0001 | `—` | `0837073ce210d31cef79ea397483ebc5` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x00158d008bbb011a` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.office_window_contact_sensor_contact` — Office Window (`mqtt`) | | | | | |
|  | ↳ `button.office_window_contact_sensor_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbb011a_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbb011a_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.0x00158d008bbb011a_trigger_count` — Trigger count (`mqtt`) | | | | | |
|  | ↳ `sensor.office_window_contact_sensor_battery` — Battery (`mqtt`) | | | | | |
|  | ↳ `sensor.office_window_contact_sensor_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.office_window_contact_sensor_voltage` — Voltage (`mqtt`) | | | | | |
| [ ] | **Steph Nightstand Light** | Philips / Hue white E12 / 1.163.1 | `—` | `5274d1253e3dc5b5f5aa0439a03dc793` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010eb8a3dd` |
|  | _Entities_ | | | | | |
|  | ↳ `button.steph_nightstand_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.steph_nightstand_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.steph_nightstand_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010eb8a3dd_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.steph_nightstand_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010eb8a3dd_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.steph_nightstand_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.steph_nightstand_light` — — (`mqtt`) | | | | | |
| [ ] | **Stephen Nightstand Light** | Philips / Hue white E12 / 1.163.1 | `—` | `9627256e311a1e6759fada489bc2fbae` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x001788010e3efcb2` |
|  | _Entities_ | | | | | |
|  | ↳ `button.stephen_nightstand_light_identify` — Identify (`mqtt`) | | | | | |
|  | ↳ `light.stephen_nightstand_light` — — (`mqtt`) | | | | | |
|  | ↳ `number.stephen_nightstand_light_effect_speed` — Effect speed (`mqtt`) | | | | | |
|  | ↳ `select.0x001788010e3efcb2_effect` — Effect (`mqtt`) | | | | | |
|  | ↳ `select.stephen_nightstand_light_power_on_behavior` — Power-on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x001788010e3efcb2_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `text.stephen_nightstand_light_effect_color` — Effect color (`mqtt`) | | | | | |
|  | ↳ `update.stephen_nightstand_light` — — (`mqtt`) | | | | | |
| [ ] | **Upper Entryway Light Switch** | Aqara / Light Switch H2 US (double rocker) | `—` | `b37c285cd9ff4054b39f9ae13c774e2b` | `bbbd69786881ac0790e69dba1e7b26f0` | `0x54ef4410012dfab3` |
|  | _Entities_ | | | | | |
|  | ↳ `event.upper_entryway_light_switch_action` — Action (`mqtt`) | | | | | |
|  | ↳ `select.upper_entryway_light_switch_mode_switch` — Mode switch (`mqtt`) | | | | | |
|  | ↳ `select.upper_entryway_light_switch_operation_mode_top` — Operation mode top (`mqtt`) | | | | | |
|  | ↳ `select.upper_entryway_light_switch_power_on_behavior` — Power on behavior (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012dfab3_linkquality` — Linkquality (`mqtt`) | | | | | |
|  | ↳ `sensor.0x54ef4410012dfab3_power_outage_count` — Power outage count (`mqtt`) | | | | | |
|  | ↳ `sensor.upper_entryway_light_switch_device_temperature` — Temperature (`mqtt`) | | | | | |
|  | ↳ `sensor.upper_entryway_light_switch_power` — Power (`mqtt`) | | | | | |
|  | ↳ `switch.upper_entryway_light_switch_flip_indicator_light` — Flip indicator light (`mqtt`) | | | | | |
|  | ↳ `switch.upper_entryway_light_switch_led_disabled_night` — Led disabled night (`mqtt`) | | | | | |
|  | ↳ `switch.upper_entryway_light_switch_lock_relay_top` — Lock relay top (`mqtt`) | | | | | |
|  | ↳ `switch.upper_entryway_light_switch_multi_click_wireless` — Multi click wireless (`mqtt`) | | | | | |
|  | ↳ `switch.upper_entryway_light_switch_top` — Top (`mqtt`) | | | | | |
|  | ↳ `update.upper_entryway_light_switch` — — (`mqtt`) | | | | | |
| [ ] | **Zigbee2MQTT Bridge** | Zigbee2MQTT / Bridge / 2.12.1 | `—` | `96e69a31d2222d95285093b10aab332e` | `—` | `0x00124b0031de779a` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.zigbee2mqtt_bridge_connection_state` — Connection state (`mqtt`) | | | | | |
| [ ] | **Zigbee2MQTT Bridge** | Zigbee2MQTT / Bridge / 2.14.1 | `—` | `bbbd69786881ac0790e69dba1e7b26f0` | `—` | `0xc02cedfffe15d0d9` |
|  | _Entities_ | | | | | |
|  | ↳ `binary_sensor.zigbee2mqtt_bridge_connection_state_2` — Connection state (`mqtt`) | | | | | |
|  | ↳ `binary_sensor.zigbee2mqtt_bridge_restart_required` — Restart required (`mqtt`) | | | | | |
|  | ↳ `button.zigbee2mqtt_bridge_restart` — Restart (`mqtt`) | | | | | |
|  | ↳ `select.zigbee2mqtt_bridge_log_level` — Log level (`mqtt`) | | | | | |
|  | ↳ `sensor.zigbee2mqtt_bridge_coordinator_version` — Coordinator version (`mqtt`) | | | | | |
|  | ↳ `sensor.zigbee2mqtt_bridge_network_map` — Network map (`mqtt`) | | | | | |
|  | ↳ `sensor.zigbee2mqtt_bridge_version` — Version (`mqtt`) | | | | | |
|  | ↳ `switch.zigbee2mqtt_bridge_permit_join` — Permit join (`mqtt`) | | | | | |
