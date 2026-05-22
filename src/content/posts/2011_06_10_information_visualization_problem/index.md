---
title: "The Information Visualization Problem"
pubDate: "2011-06-09"
description: "Inspired by my pervious post about Visualizing Software Systems I started to think about the more general problem of information visualization. The major differ..."
tags: ["drawing"]
icon: "/posts/2011_06_10_information_visualization_problem/first.jpg"
---

<p>
			First, I introduce my thoughts that preceded the step of creating the illustrations:
			At my work I am trying to understand the interaction between machines and humans.
			Machines typically process data and provide some for of presentation for the user.
			The data can be arbitrarily complex, while the presentation has to be simple enough for the user to understand.
			Therefore, there has to be a transformation process simplifying the raw data to usable bits of content, which are then layed out on the screen (or other physical devices).
			The user finally perceives the presentation and processes the information cognitively before acting upon it.
			These relationships inspired me to create the following two illustrations.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2011_06_10_information_visualization_problem/first.jpg"><img src="/posts/2011_06_10_information_visualization_problem/first.jpg" style="height: 12em; margin-right: 1em;"/></a>
			<a href="/posts/2011_06_10_information_visualization_problem/second.jpg"><img src="/posts/2011_06_10_information_visualization_problem/second.jpg" style="height: 12em;"/></a>
		</p>
		<p>
			The illustration to the left preceeded the illustration to the right.
			The idea was to lay out the different information models horizontally (in other words sequentially) to emphazise the natural layering.
			Labelled arrows between them indicate the interaction between the models.
			Finally, a boundary between machine and human is drawn to group the contained concepts.	
		</p>
		<p>
			My impression of this first illustration was that it is difficult to understand the structure of the information quickly, i.e. what bits of text and drawing belong together and how are they connected.
			This critique led me to the improved version to the right.
			The idea was to group picture contents that belong together by closed shapes.
			You can see the immediate benefit of this technique when comparing the two versions of the illustration.
			Clearly, the version to the right gives a much cleaner and structured impression, though most parts of the drawings are identical.
		</p>
		<p>
			To understand the structure of the previous two illustrations better, I decided to draw their contents in a tree format (root node, child nodes, leaf nodes).
			This idea resulted in the following picture.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2011_06_10_information_visualization_problem/three.jpg"><img src="/posts/2011_06_10_information_visualization_problem/three.jpg" style="width: 90%;"/></a>
		</p>
		<p>
			The main observation is that some image contents (the <em>meta level</em> 1 and 2) are solely used to group the actual image content (the <em>leaf nodes</em> data/content/presentation/user).
			The really interesting content are the attributes and relationships of the leaf nodes in the information tree.
			For the illustration this means that the meta nodes are translated into areas and boundaries, while the leaf nodes are translated into groups of text, drawings, and arrows.
		</p>
		<p>
			Obviously, this is just a single and small example for the visualization problem and there are my more aspects to it than indicated here.
			Nevertheless, I hope you gained a basic understanding for the complexity of the issue, but also the need for proper models, tools and techniques to create efficient visualizations.
		</p>
