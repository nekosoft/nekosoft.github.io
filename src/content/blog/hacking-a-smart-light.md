---
title: "Hacking a smart light: a hands-on BLE lab"
description: I built a deliberately weak Bluetooth smart light and then took it apart with nRF Connect. Four attacks you can run yourself, and what each one would mean if the device wasn't a toy.
pubDate: 2026-11-16
tags: ["IoT / Hardware", "Bluetooth LE"]
draft: false
---

I spend a lot of time telling people their Bluetooth gadgets are chattier than they think, and it turns out that's much easier to show than to explain. So I built a fake smart light called Nova Glow on an ESP32-C6, and left in the kind of mistakes I keep running into on real products. Everything below you can do yourself with [nRF Connect](https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-mobile) on your phone, against something that behaves like a light you might actually buy.

I'll cover:

- the handful of BLE words you need, and how to drive nRF Connect
- controlling the light with no pairing, and reading the Wi-Fi password straight off it
- getting it to flood your phone with made-up alarms
- the factory-unlock command that isn't in the app at all
- and what I'd want to see done instead

## BLE overview

A BLE device is really just a menu of values that a phone can read or change. Five words get you most of the way:

| Term | What it is |
|---|---|
| **Peripheral** | The device. Nova Glow. It *advertises* so phones can find it. |
| **Central** | Your phone. It scans, connects, and sends commands. |
| **Service** | A labelled group of features, each with a **UUID**. |
| **Characteristic** | One value you read or write: power, colour, status. |
| **Properties** | What you're allowed to do with it: **Read**, **Write**, **Notify**. |

So a central connects to a peripheral, opens up its services, and reads or writes the characteristics inside them. Nova Glow's UUIDs are long (`4e4f5641-…-0004`), but only the last four digits ever change, so that's all I'll point at.

## Finding your way around nRF Connect

Every characteristic has little icons down the right-hand side:

| Icon | Button | What it does |
|---|---|---|
| single down arrow | **Read** | Pull the current value once. |
| single up arrow | **Write** | Send a value you type. |
| down arrow with a line | **Subscribe** | Let the device push updates to you. |

> The thing that trips everyone up: a Write is set to **Text** by default. Switch it to **Byte array**, or your hex goes out as the letters instead of the bytes and nothing behaves. And if you're trying to watch notifications and the log looks empty, turn the log level up to **Verbose**.

## Controlling the light with no pairing

Connect to `Nova Glow XX`, open the **Nova Light Control** service, and you can drive the bulb without pairing to anything. Pick a colour below, copy the hex, and write it to the **Color** characteristic (`…0004`):

<iframe src="/blog/hacking-a-smart-light/color-picker.html" title="BLE colour picker: the hex to write to the Color characteristic" loading="lazy" style="width:100%;height:150px;border:1px solid #35306b;border-radius:12px;background:#13102b;margin:12px 0"></iframe>

1. Find **Color** (`…0004`), tap **Write**, set the format to **Byte array**, paste the hex and send. The LED changes straight away.
2. **Power** (`…0002`): write `00` for off, `01` for on.
3. **Brightness** (`…0003`): write a single byte like `20` to dim it.

> Nothing in that exchange checked who I was. No pairing, no PIN, no login, just a phone that happened to be close enough. On a light that's a party trick. I've seen the same gap on locks that open for any handset in range, and on kit where a stranger sending the wrong value is a far bigger deal than a colour change. Being able to connect quietly became permission to act.

## Reading the Wi-Fi password off a characteristic

Config sounds dull, so people skip it. Find **Config** (`…0006`) and tap **Read** anyway. With nothing asked of me in return, out comes:

```json
{
  "wifi_ssid":   "NovaLabs-Guest",
  "wifi_pass":   "sunflower-42!",
  "admin_pin":   "8080",
  "cloud_token": "nv_live_7c1a9f3e"
}
```

> Whatever a characteristic will hand back, it hands to anyone in range, and this one gives up a Wi-Fi password, an admin PIN and a cloud token. The Wi-Fi password on its own puts someone on the network behind the firewall; the token lets them talk to the backend as if they were the device. I've pulled genuine credentials out of genuine products exactly like this. None of it should sit somewhere a passer-by can read it.

## Flooding the phone with fake alarms

1. Find **Status** (`…0007`) and tap **subscribe**, the arrow with a line. It stays lit.
2. Find **Effect** (`…0008`), tap **Write**, set the format to **Byte array**, enter `FF` and send.
3. Watch **Status** run through `EVT#0 motion zone=1`, `tamper detected`, `intrusion!` and so on, 255 times over.

> Worth saying, because it confuses people: a notification in BLE is just the device pushing a fresh value at you, there's no pop-up involved. Each line that changes is one packet. If you'd rather actually read them, send `05` instead of `FF`.

> There are two problems knotted together here. The first is the ratio. I sent one byte and got 255 messages back, unasked and unauthenticated, which on a coin-cell device is a tidy way to flatten the battery and on anything is enough noise to bury a real alert. The second is that I invented every one of those messages. A phone app or a hub reads `motion` and `intrusion` and takes them at face value, because nothing tells it the light might be making things up.

## Unlocking factory mode through a hidden characteristic

The app only ever touches three characteristics. The device has more. Scroll the whole service and you'll find one ending `…00ff` that no documentation mentions.

1. Tap its **Write**, set the format to **Text**, type `NOVA` (or `4E4F5641` as a Byte array) and send.
2. **Read** it back. It now says `UNLOCKED: factory mode enabled`.

> This is a backdoor, left in because someone assumed nobody would look past the menu the app shows them. Attackers don't use the app. They list every characteristic on the device and poke the ones that aren't meant to be there. Plenty of shipped hardware has an engineering mode or an unlock string sitting right next to the normal controls, and "no one knows it's here" has never counted for much.

## What I'd want instead

Same four problems, turned around:

- Make the device check that the phone is *allowed*, not just *able*. Pair, encrypt the link, and authorise the specific action rather than the connection.
- Once setup is done, get the provisioning data off the radio, and keep anything sensitive behind that encrypted link.
- Cap how much the device can send without being asked, and let whatever is listening treat events as claims to verify rather than facts.
- Take debug and factory modes out of production builds, and work on the assumption that someone will find every characteristic you leave in.

If there's one habit worth taking from this, it's assuming anything on the air is reachable by someone you didn't invite, and making the device decide every single time what that someone gets to do. Nova Glow decides nothing, which is exactly why it's such a good thing to pull apart.

Nova Glow isn't a product. It's a target I built to practise on, and everything weak about it is weak on purpose.
