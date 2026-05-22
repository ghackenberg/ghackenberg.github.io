---
title: "JavaScript graph libraries: Cytoscape vs. Sigma vs. D3"
pubDate: "2015-12-20"
description: "Recently, I added tags to my blog posts and scientific publications. The tags allow me to connect my articles based on keywords and topics. I use the tags to im..."
tags: ["blog", "data-visualization", "zumida", "hyperkit-software"]
icon: "/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/cytoscape.png"
---

<p>
			The implementation with all three JavaScript libraries was straight forward.
			In all three cases, I had to convert the tag information into a proprietary <a href="http://www.json.org/" target="_blank">JSON</a> format.
			Converting the tag information into the proprietary format took me less than 30 minutes coding and less and 100 lines of code per JavaScript library.
			Then, each JavaScript library requires its own configuration of the display style.
			<a href="http://js.cytoscape.org/" target="_blank">Cytoscape</a> and <a href="http://sigmajs.org/" target="_blank">Sigma</a> provide style configuration objects, which support basic style options.
			<a href="http://d3js.org/" target="_blank">D3</a> on the other hand provdes seamless integration with <a href="https://en.wikipedia.org/wiki/Cascading_Style_Sheets" target="_blank">CSS</a>, which enables a wide variety of style options.
			Furthermore, the library provides a stream processing API, which can be exploited for advanced style manipulations.
			However, <a href="http://d3js.org/" target="_blank">D3</a> also requires extra code for rendering the graph layout, which can be omitted in <a href="http://js.cytoscape.org/" target="_blank">Cytoscape</a> and <a href="http://sigmajs.org/" target="_blank">Sigma</a>. Here are the visualization results for the individual JavaScript libraries (<strong>click to run in your browser</strong>):
		</p>
		<p>
			<a href="/visualizations/cytoscape/" style="display: block; float: left; text-align: center; width: calc((100% - 3em) / 3); margin-right: 1em;">
				<img src="/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/cytoscape.png?width=500&amp;height=400" style="width: 100%;"/>
				Cytoscape
			</a>
			<a href="/visualizations/sigma/" style="display: block; float: left; text-align: center; width: calc((100% - 3em) / 3); margin-right: 1em;">
				<img src="/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/sigma.png?width=500&amp;height=400" style="width: 100%;"/>
				Sigma
			</a>
			<a href="/visualizations/d3/" style="display: block; float: left; text-align: center; width: calc((100% - 3em) / 3);">
				<img src="/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/d3.png?width=500&amp;height=400" style="width: 100%;"/>
				D3
			</a>
			<br clear="all"/>
		</p>
		<p>
			From this first experience with using those three libraries I want to make a first conclusion on in which situation to use which of the JavaScript libraries.
			Please note that my experience is limited to getting started knowledge about the presented libraries only.
			More advanced users might think differently about the features and potentials of the individual libraries.
			<ul>
				<li>Use <a href="http://js.cytoscape.org/" target="_blank">Cytoscape</a> if you want to have <strong>computationally fast</strong> results.</li>
				<li>Use <a href="http://sigmajs.org/" target="_blank">Sigma</a> if you want to have <strong>basic interactive</strong> results.</li>
				<li>Use <a href="http://d3js.org/" target="_blank">D3</a> if you want to have <strong>maximum customizable</strong> results.</li>
			</ul>
			I hope with this post I could help some of you guys on the question which JavaScript graph library to use in what situation.
			Also, I would be interested in feedback from other developers on using those libraries for different purposes.
			Please note that we also provide alternative graph visualization and exploration techniques in <a href="http://www.zumida.com/" target="_blank">Zumida</a>, a product of <a href="http://www.hyperkit-software.com/" target="_blank">Hyperkit Software</a>.
		</p>
