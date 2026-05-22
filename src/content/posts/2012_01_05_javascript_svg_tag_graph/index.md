---
title: "JavaScript/SVG Tag Graph Interface"
pubDate: "2012-01-04"
description: "Here's another interface in the series of JavaScript/SVG interactive respectively animated prototypes: The tag graph. The idea is to display the article tags as..."
tags: ["blog", "data-visualization", "hyperkit-software", "zumida"]
icon: "/posts/2012_01_05_javascript_svg_tag_graph/javascript.png"
---

The implementation is compatible with recent versions of **Internet Explorer**, **Mozilla Firefox**, **Opera** and **Google Chrome/Apple Safari**.
The following image shows a sample output for this blog.

![](/posts/2012_01_05_javascript_svg_tag_graph/screenshot.png)

The graph is generated using **PHP**, layouted using **JavaScript** and rendered using **SVG**.
The PHP script basically generates lines for connections between tags, and circles/text elements for the tags themselves.
Most of the code is specific to my custom blogging API.

![](/posts/2012_01_05_javascript_svg_tag_graph/php.png)

The JavaScript contains the magic behind the interface.
Upon page load the tags are arranged randomly on the canvas.
Then, an interval is started to move the tags to their final location step by step.
The update functions finally copy the layout algorithm values to the DOM SVG nodes.

![](/posts/2012_01_05_javascript_svg_tag_graph/javascript.png)

Try it out yourself: `http://www.georg-hackenberg.de/interface/graph.html`.
If you would like to provide such interface for your own website, access the code via [http://svn.hyperkit-software.com/personalblog/](http://svn.hyperkit-software.com/personalblog/).
