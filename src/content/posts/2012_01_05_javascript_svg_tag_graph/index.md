---
title: "JavaScript/SVG Tag Graph Interface"
pubDate: "2012-01-04"
description: "Here's another interface in the series of JavaScript/SVG interactive respectively animated prototypes: The tag graph. The idea is to display the article tags as..."
tags: ["blog", "data-visualization", "hyperkit-software", "zumida"]
icon: "/posts/2012_01_05_javascript_svg_tag_graph/javascript.png"
---

<p>
			The implementation is compatible with recent versions of <strong>Internet Explorer</strong>, <strong>Mozilla Firefox</strong>, <strong>Opera</strong> and <strong>Google Chrome/Apple Safari</strong>.
			The following image shows a sample output for this blog.
		</p>
		<p style="text-align: center;">
			<img src="/posts/2012_01_05_javascript_svg_tag_graph/screenshot.png" style="width: 100%;"/>
		</p>
		<p>
			The graph is generated using <strong>PHP</strong>, layouted using <strong>JavaScript</strong> and rendered using <strong>SVG</strong>.
			The PHP script basically generates lines for connections between tags, and circles/text elements for the tags themselves.
			Most of the code is specific to my custom blogging API.
		</p>
		<p style="text-align: center;">
			<img src="/posts/2012_01_05_javascript_svg_tag_graph/php.png" style="width: 80%;"/>
		</p>
		<p>
			The JavaScript contains the magic behind the interface.
			Upon page load the tags are arranged randomly on the canvas.
			Then, an interval is started to move the tags to their final location step by step.
			The update functions finally copy the layout algorithm values to the DOM SVG nodes.
		</p>
		<p style="text-align: center;">
			<img src="/posts/2012_01_05_javascript_svg_tag_graph/javascript.png" style="width: 50%;"/>
		</p>
		<p>
			Try it out yourself: <code>http://www.georg-hackenberg.de/interface/graph.html</code>.
			If you would like to provide such interface for your own website, access the code via <a class="web" href="http://svn.hyperkit-software.com/personalblog/">http://svn.hyperkit-software.com/personalblog/</a>.
		</p>
