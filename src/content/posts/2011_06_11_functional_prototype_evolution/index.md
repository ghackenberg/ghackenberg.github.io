---
title: "The Evolution of a Functional Prototype"
pubDate: "2011-06-10"
description: "In a previous article From Sketch to Prototype I illustrated the change from fuzzy whiteboard sketches to more structured and formal HTML prototypes. In this ar..."
tags: ["blog", "user-interface", "drawing"]
icon: "/posts/2011_06_11_functional_prototype_evolution/data.png"
---

Again we start by sketching the layout idea on the whiteboard.
We use different colors for grouping similar content structures.
Annotations (in our case black) are also a good idea to evoke further associations with the presented content.

[![](/posts/2011_06_11_functional_prototype_evolution/start.jpg)](/posts/2011_06_11_functional_prototype_evolution/start.jpg)

It is probably not surprising that again I arrived at a tabular layout of my website contents.
Also the icon-style illustrations of content categories is a common pattern that I have used frequently in previous design prototypes.

Now the next step in the evolution of the interface idea is to transform the fuzzy whiteboard drawing into a more formal HTML/CSS prototype with icons downloaded from Google images.

[![](/posts/2011_06_11_functional_prototype_evolution/intermediate.png)](/posts/2011_06_11_functional_prototype_evolution/intermediate.png)

You see again some sort of transformation of the initial design proposal.
Similar to other cases horizontal and vertical color shades are introduced to separate header from content cells plus the individual columns.
On the other side the contents themselves are not elaborated well because only one type of icon is used and the text is simply copied.
However, the static prototype was already sufficient to judge the technical feasibility and decide for a functional implementation.

This functional implementation takes the next step by integrating exemplary data into the interface.
For the first column I used four random articles from my blog.
For the second column I selected four projects from my [Source Code Portal](http://www.hyperkit-software.com).
For the third column I created new content which I haven't been using before.
For the fourth column I copied the top-level structure of my resume.

[![](/posts/2011_06_11_functional_prototype_evolution/end.png)](/posts/2011_06_11_functional_prototype_evolution/end.png)

In this case several transformations took place:
(1) The *Articles* column was extended because its contents were generally larger than the contents of the other columns.
(2) Column-specific icons are also used for the individual contents.
(3) The article contents are extended by publication date and a list of contained images.
This content-specific layout variation was possible because the underlying data gave the necessary inspiration.

In the following I provide you with a view onto the file structure of the functional prototype to give you a feeling of the complexity of the implementation as well as the required effort.

[![](/posts/2011_06_11_functional_prototype_evolution/folders.png)](/posts/2011_06_11_functional_prototype_evolution/folders.png)
[![](/posts/2011_06_11_functional_prototype_evolution/data.png)](/posts/2011_06_11_functional_prototype_evolution/data.png)
[![](/posts/2011_06_11_functional_prototype_evolution/model.png)](/posts/2011_06_11_functional_prototype_evolution/model.png)
[![](/posts/2011_06_11_functional_prototype_evolution/view.png)](/posts/2011_06_11_functional_prototype_evolution/view.png)
[![](/posts/2011_06_11_functional_prototype_evolution/theme.png)](/posts/2011_06_11_functional_prototype_evolution/theme.png)

It should be noted that many parts of the implementation have been reused from existing projects.
In particular, the *Model* and the *Controller* are very similar in structure and behavior to other web applications I developed in PHP.
Therefore most of the implementation is copy and paste (as I have not thought of a better mechanism for reuse yet).

Let me know what you think if the article!
I am also interested in feedback on the prototype itself, as it might be the coming interface for my website.
