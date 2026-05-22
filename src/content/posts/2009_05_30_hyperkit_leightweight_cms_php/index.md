---
title: "HyperKit - A lightweight CMS written in PHP."
pubDate: "2009-05-29"
description: "Recently, I helped a friend of mine who is starting his own business with his website. I searched for a lightweight content management system which provides eno..."
tags: ["hyperkit-software", "user-interface"]
icon: "/posts/2009_05_30_hyperkit_leightweight_cms_php/setup.jpg"
---

Content management has been a topic for several years now.
I remember working with my first CMS when I was 18.
Back then, I was working for a marketing agency in my local town.
We were using *Typo3*, which is a huge and powerful system, but also a big pain in the ass! `:)`
The worst about Type3 was the fact, that you had to use a proprietary language for coding templates, called *TypoScript*.
Also, the editor for coding the scripts was a simple HTML `textarea`, which prevented the developer from using proper intendation for making the code readable.
Maybe, nowadays these drawbacks have changed, but still I believe the system is too big for using it for certain businesses.
Additionally, the developer has to deal with complicated modules for extending the system functionality, which makes it even worse.

Other projects go the exact opposite way: They try to provide a minimal system for making development as easy as possible.
As an example I want to mention [CMS from Scratch](http://cmsfromscratch.com/).
I installed the system and started implementing my friends website.
It was really easy to use and the design was coded after a few minutes.
But then it came to extending the functionality for providing picture galleries and other content modules.
There, the drawbacks of the system revield, as it was not obvious to me how to implement that.

Finally, I decided to design and implement my own concept: *HyperKit*.
The basic idea of HyperKit is, to make organize all the content entered by the web developer in *collections* (or *content modules*).
I.e. there are collections for the HTML pages themselves, for images, for blog articles and for anything else you can imagine.
When installed from scratch, HyperKit does not provide any collection except the **Setup collection**.
Each content added to the setup collection is transformed into a collection on it's own.
To illustrate this, I have taken a screenshot from the official [HyperKit website](http://www.hyperkit-software.com) backend.

[![](/posts/2009_05_30_hyperkit_leightweight_cms_php/setup.jpg)](/posts/2009_05_30_hyperkit_leightweight_cms_php/setup.jpg)

The screen shows the HyperKit backend.
The user currently opened the setup collection.
The setup collection contains as first element the *page collection*.
The second collection is the *fragments collection* which contains reusable HTML/PHP snippets such as the page header and the page footer.
As you can see on the left hand side, these collections are also accessible via the navigation column.
From there, the actual contents of the collections can be edited.
E.g. for the *pages collection*, the user can start editing the HTML pages, define titles, labels, descriptions and much more.
Actually, the fields which are available are determined by an XML configuration file.

In a later article, I will explain the technical aspects in greater detail.
For now, you can have a look at the offical project page under [http://www.hyperkit-software.com](http://www.hyperkit-software.com).
I hope to get feedback for the system.
Maybe it can grow into a mature toolkit for web developers in the near future!
