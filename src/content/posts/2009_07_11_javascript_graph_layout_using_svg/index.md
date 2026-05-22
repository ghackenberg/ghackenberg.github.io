---
title: "JavaScript Graph Layout using SVG."
pubDate: "2009-07-10"
description: "Nowadays, it is not a simple task to integrate interactive graphs into Web applications. Graphs could be used in various ways from presenting overviews to prese..."
tags: ["data visualization","hyperkit software","zumida"]
icon: "/posts/2009_07_11_javascript_graph_layout_using_svg/javascript.png"
---

<p>
			The current prototype is restricted to use with SVG-enabled browsers such as <em>Mozilla Firefox</em> or <em>Opera</em>.
			I decided to use SVG to draw circles and lines which provides a much richer visual presentation of graphs.
			The original prototype used HTML <code>div</code> elements and didn't draw edges between the nodes.
			The following picture is an example graph rendered with the engine:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_07_11_javascript_graph_layout_using_svg/svg.png"><img src="/posts/2009_07_11_javascript_graph_layout_using_svg/svg.png"/></a>
		</p>
		<p>
			The nodes are represented as red circles.
			Each node is identified by a numbered label.
			Edges are drawn as dashed lines.
			The numbers on the edges represent the deviation of the edge length from the optimal edge length.
			The optimal edge length can be defined by the user.
			This way, the user can specify, how much the graph structure is extended or contracted.
		</p>
		<p>
			Now, let's have a look, how the graph is specified in the backend.
			Currently, there is a simple functional API for creating and linking nodes as well as starting the layout algorithm.
			The setup for the graph above is presented in the following figure:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_07_11_javascript_graph_layout_using_svg/javascript.png"><img src="/posts/2009_07_11_javascript_graph_layout_using_svg/javascript.png"/></a>
		</p>
		<p>
			The calls to the method <code>createNode</code> currently add a node item to the internal data structures and return a node identifier.
			The calls to the method <code>linkNodes</code> add edges to the internal data structures for the two nodes specified in the first two arguments.
			The third argument is the optimal edge length.
			In a general case, this edge length could be set to a constant value for all edges.
			The method <code>displayComment</code> is currently used for showing related information to the test case.
			This information is usually used to annotate the test case for ideas on how to improve the algorithm.
			Finally, the <code>startAlgorithm</code> call is responsible for moving the SVG elements to the correct locations.
		</p>
		<p>
			Soon, I plan to extend this framework for non-SVG enabled browsers.
			Also the API needs some refactoring.
			An object-oriented design might be more suited, to even support multiple graphs on a single page and simple AJAX support.
		</p>
		<p>
			I hope you like the idea for this toolkit.
			Give me some feedback!
		</p>
		<p>
			<a class="package" href="/posts/2009_07_11_javascript_graph_layout_using_svg/source.zip">Download the source code!</a>
		</p>
