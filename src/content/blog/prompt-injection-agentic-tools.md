---
title: Prompt injection in agentic AI tooling
description: When an LLM can call tools, untrusted text becomes untrusted instructions. Treat the model like a confused deputy.
pubDate: 2026-06-28
tags: ["LLM / Agentic AI", "Application Security"]
---

The moment you let a language model call tools — read files, hit APIs, run
code — every piece of text it reads becomes a potential instruction. Prompt
injection stops being a curiosity and becomes a genuine application security
problem.

## The confused deputy, again

An agent acts with your privileges but takes direction from content it doesn't
control. A malicious web page, document, or email can quietly redirect it. It's
the confused deputy problem wearing a new hat.

## Defences that actually help

- Treat model output as untrusted input to every tool it drives
- Constrain tool scope with real authorisation, not prompt instructions
- Keep a human in the loop for anything irreversible

This is just the overview — I'll be adding more about this in future.
