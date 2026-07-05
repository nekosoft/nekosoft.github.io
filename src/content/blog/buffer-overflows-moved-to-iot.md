---
title: Buffer overflows didn't die, they moved to IoT
description: The memory-safety bugs everyone declared dead are alive and well in embedded firmware. Here's why.
pubDate: 2026-06-03
tags: ["Embedded & Hardware", "IoT", "Offensive Security"]
---

I was told buffer overflows were a solved problem — mitigations everywhere,
memory-safe languages taking over. Then I started pulling apart embedded
devices, and it was 2005 all over again.

## The web moved on, firmware didn't

Modern web stacks are largely memory-safe by default. Firmware, written in C
against tight constraints and shipped once, often isn't. No ASLR, no stack
canaries, and an update story that ranges from "difficult" to "never".

## Why it matters

These devices sit on networks people forget exist — cameras, sensors,
gateways. A classic overflow on a device that never gets patched is a foothold
that stays open for years.

This is just the overview — I go deeper into connected devices, embedded
software and the protocols they speak in my
[IoT research documentation](/docs/iot).
