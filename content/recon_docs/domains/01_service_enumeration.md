---
title: Service and Software Enumeration for Modern Web Applications, IoT
type: docs
prev: recon_docs/domains/00_domains
---

- this might be split into two different sections. Not all IoT will include a web application or web communication. 
- can talk about specific protocols
- not sure if this is the right title with the relevant topics

## Protocols and Common Ports

Different protocols communicate in various ways. They might have a structured way to send and receive data, or completely unstructured. 

There are some protocols where only a model is defined, and it's largely up to the developer to implement it that way unless there is widespread usage and a need for standardisation. Developers can still choose to implement something against the standard, which we will talk about more when covering more topics such as specific protocols, API designs and frameworks.


## Communication and API's

Depending on the protocol, there may be standardized ways to communicate. This could include API design and what functionality and data is available, it could be fundamentally how a message is sent and received.

We will go over several different architecture patterns, how they relate to protocols, database quirks and more. An important aspect is understanding how this communication happens and at what aspect we might be able to find certain data.

### What we are looking for:

- how does the client communicate with the server?
    - it could be API design / architecture pattern
    - official and unofficial documentation
- what kind of information could we potentially access?
    - API or function calls that are being made, some might be hidden
- what would the security boundaries be?
    - it could be between accounts, databases and more


### Where can we find it:

#### Common API Architectures and Designs




Some assumptions we have about what we are investigating:

- there is data that needs protection, something that shouldn't be accessible to the public (such as personal identifiable information, think your full name and address)
- there are features that are of high value, such as a payment system
- there is a way to communicate with this data, we may need to look at authentication and authorisation




## Fingerprinting

- need to update
- what is fingerprinting
- how to?