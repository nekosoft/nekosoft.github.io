---
title: Domain Names
type: docs
prev: recon_docs/domains/
next: recond_docs/domains/01_service_enumeration
---

I like to start with domain names, when you visit `example.com` you're visiting a human readable address, something that's easy for you to remember. Other systems look up what the address is, if we can visit it, if anything is hosted there and the location where those files are hosted. I was curious about this, so I start from a broad business approach to reconnaissance, to then something technically deep. I'll cover:

- a quick note about local and remote DNS (I might expand on this one day)
- different types of information you can gather just from a domain name and some datasets / tooling to gather it with
- finding the underlying system the resources are hosted on, and possibly a network of systems
- how to validate that is current or relevant information

**A bit about what got me interested in learning more about domain names and open source intelligence**

I was registering domain names as a kid, and as I moved into the small business owner realm, I started discovering just how much private information could be (or is already) made public. This starts all the way from registering a business, to connecting your first system online. 

For the general public to get their hands on a domain name:

- Domain names need to be registered via a registrar, many companies offer this service (I used to co-own a company that sold domain names)
- There are many top level domains, each with their own requirements, not all top level domains are registered by the same registrar and the process to register a domain may be quite relaxed with their security policies - a .com may not be managed or accessible the same way a .gov is
- You can't always rely on `example.com` to host the same on `example.be` - it could be two totally different owners / creators
- Some top level domains are protected spaces or require extra information to be able to register it, for example a .com.au needed to be purchased by someone with a registered business (an Australian Business Number or ABN)


## What makes up a domain?

Let's take a brief overview about what makes up a domain name and a quick overview of Uniform Resource Locators (URL's).

### A Domain Name

![Domain Name Overview](/images/domain_name.png)


This is generally the human readable name we want people to type in so that they can visit any hosted resources, such as a website.

### Top Level Domains

Domain names are generally registered by people, on behalf of themselves or a company. Domain names can also be registered against a company. The important thing to note is that there are many Top Level Domains available, and buying a domain i - `example.com` may not point to the same website or creator as `example.be`. 

Domain names may have special rules, such as being a business in a certain country or working for a particular government organisation. It is not guaranteed that all top level domains will always exist.

This is a list of valid Top Level Domains maintained by the IANA, it's a handy list to use to generate your own wordlists.

https://data.iana.org/TLD/tlds-alpha-by-domain.txt


### Who registered a domain name?

Who or what registered a domain name could be our first piece of information about a target's attack surface. From a business standpoint, who works for the company, their current and past products, mergers and acquisitions, could all be pieces of information that could lead to an entrypoint into gaining unauthorized access into the company and its data.


## How to expand the attack surface


Domain Names

- who registered them
- where are they hosted
- historical and current whois records
- reputation
- typo squatted domains
- Top Level Domains