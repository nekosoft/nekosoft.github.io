---
title: Mapping attack surface with passive recon
description: How I build a picture of a target before touching it — domains, certificates, and the trails organisations leave in public.
pubDate: 2026-05-12
tags: ["Offensive Security", "Reconnaissance", "Web & Cloud"]
---

Before I send a single packet at a target, I want to know what it looks like
from the outside. Passive reconnaissance is about assembling that picture from
sources that never touch the target directly — certificate transparency logs,
DNS history, public code, job listings, and the quiet metadata organisations
scatter across the web.

## Why passive first

Every active probe is noise, and noise gets you noticed. Passive recon lets me
map the likely attack surface, prioritise, and only then spend active requests
where they matter.

## Where I start

- Certificate transparency for subdomains that were never meant to be public
- DNS and ASN data to understand where things are actually hosted
- Public repositories and CI config for leaked endpoints and secrets

This is just the overview — I walk through my full reconnaissance
methodology, from domains and URLs to service enumeration, in the
[Web Reconnaissance documentation](/docs/web-recon).
