---
title: Domain Names
type: docs
prev: recon_docs/domains/
---

I like to start with domain names, when you visit `example.com` you're visiting a human readable address, something that's easy for you to remember. Other systems look up what the address is, if we can visit it, if anything is hosted there and the location where those files are hosted. I was curious about this, so I start from a broad business approach to reconnaissance, to then something technically deep. I'll cover:

- a quick note about local and remote DNS (I might expand on this one day)
- different types of information you can gather just from a domain name and some datasets / tooling to gather it with
- finding the underlying system the resources are hosted on, and possibly a network of systems
- how to validate that is current or relevant information

## A bit about what got me interested in learning more about domain names and open source intelligence

I was registering domain names as a kid, and as I moved into the small business owner realm, I started discovering just how much private information could be (or is already) made public. This starts all the way from registering a business, to connecting your first system online. 

For the general public to get their hands on a domain name:

- Domain names need to be registered via a registrar, many companies offer this service (I used to co-own a company that sold domain names)
- There are many top level domains, each with their own requirements, not all top level domains are registered by the same registrar and the process to register a domain may be quite relaxed with their security policies - a .com may not be managed or accessible the same way a .gov is
- You can't always rely on `example.com` to host the same on `example.be` - it could be two totally different owners / creators
- Some top level domains are protected spaces or require extra information to be able to register it, for example a .com.au needed to be purchased by someone with a registered business (an Australian Business Number or ABN)

## Top Level Domains - what the .com really means

Domain names are generally registered by people, on behalf of themselves or a company. Domain names can also be registered against a company. The important thing to note is that there are many Top Level Domains available, managed by different (registrars) - `example.com` may not point to the same website or creator as `example.be`. 

Domain names may have special rules, such as being a business in a certain country or working for a particular government organisation. It is not guaranteed that all top level domains will always exist.

## What makes up a domain?

Let's take a brief overview about what makes up a domain name and a quick overview of Uniform Resource Locators (URL's). Let's talk about what these are and if there are any differences.

### A Domain Name

![Domain Name Overview](../images/domain_name.png)

# Who registered a domain name?

Who or what registered a domain name could be our first piece of information about a target's attack surface. From a business standpoint, who works for the company, their current and past products, mergers and acquisitions, could all be pieces of information that could lead to an entrypoint into gaining unauthorized access into the company and its data.

# Let's dig technically deeper...

### A Uniform Resource Locator (URL)

![Anatomy of a URL](../images/anatomy_URL.png)

The `://` is a delimeter between the protocol and the web address. The double slash is [Sir Tim Berners-Lee's](https://en.wikipedia.org/wiki/Tim_Berners-Lee) [biggest mistake](https://archive.nytimes.com/bits.blogs.nytimes.com/2009/10/12/the-webs-inventor-regrets-one-small-thing/), "it seemed like a good idea at the time"

The protocol here is important. Generally speaking, if you are browsing "the internet", you're probably browsing sites using the HTTPS (or HTTP) protocol. Depending on your browser, you might see something like this warning to let you know that a website doesn't have a valid TLS certificate - maybe it expired. 

![HTTP Warning](content/images/http_warning.png)

It looks big and scary but we can see an error message that we could assume means the certificate data is invalid, which could be for a number of reasons - depending on the browser you use this could look different.

We will get to why these are important. For now, understanding the protocol means you have an understanding on how you might be able to communicate or use this resource, if it exists and if it is something you can interact with. There are many more protocols that exist, each with their own details to get into.

## File paths and File extensions

You can think of the path "about" as a folder or directory on your system. Directories can hold files, so our next interest is looking at what files might be accessible to us. Don't forget to keep track of the names and references we find, these can give some clues about how they work internally - for example, how programmers may name certain variables, how files might be named if we wanted to enumerate and find more, or how the company servers might be named. The names can sometimes give you clues to what information that file might have, or internal naming schemes (they could be codenames for projects, for example).

![File paths and file extensions in a URL](../images/domains_file_ext.png)

While we have touched on it, we didn't start with the Client-Server model. This model is fundamental in understanding the Request-Response messaging pattern that you'll often see with HTTP/HTTPS communications. We'll cover more in the anatomy of a HTTP Request and Response.
## Sub-Domains

When we visit a website, usually we visit "www" - but did you know that this is a subdomain?. Depending on how the website routing is configured, `www.example.com` subdomain could point to the same content as `example.com`. 

Different websites structure their data differently too. It's generally a business or "people" decision - something that needs to be considered and then set up. It can be formally defined, ad-hoc, and can even vary in how it's done within the same company. It's entirely up to them what kind of convention they come up with, it just comes with different benefits. 

`https://about.example.com`

In the above URL, the `about` appears before the domain name, this is the sub-domain.

You might notice that it looks different to the path and file extension. Both are valid ways to structure data, it just depends on needs. What's important for us is knowing that they are different, which opens up how many permutations - or how many possible ways - there is to go through the data, what is the most efficient way, vs what it is we are actually looking for. There might be some simple ways to find some of this information thanks to what the backend sends to the frontend.

---

Domain Names

- who registered them
- where are they hosted
- historical and current whois records
- reputation
- typo squatted domains
- Top Level Domains