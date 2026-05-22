---
title: "From Layout to Animation"
pubDate: "2011-06-15"
description: "In a previous article The Evolution of a Functional Prototype I demonstrated how to transform sketches into prototypes backed by database content and applicatio..."
tags: ["blog","user interface","drawing","youtube video"]
icon: "/posts/2011_06_16_from_layout_to_animation/screenshot.png"
---

<p>
			To provide some context for this article here are the images from my previous post that illustrate the change from whiteboard sketch to functional prototype.
			You can see how the sketch ideas are transformed into a more formal HTML description of layout and content.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2011_06_16_from_layout_to_animation/../2011_06_11_functional_prototype_evolution/start.jpg">
				<img src="/posts/2011_06_16_from_layout_to_animation/../2011_06_11_functional_prototype_evolution/start.jpg" style="height: 9em; margin-right: 1em;"/>
			</a>
			<a href="/posts/2011_06_16_from_layout_to_animation/../2011_06_11_functional_prototype_evolution/intermediate.png">
				<img src="/posts/2011_06_16_from_layout_to_animation/../2011_06_11_functional_prototype_evolution/intermediate.png" style="height: 9em; margin-right: 1em;"/>
			</a>
			<a href="/posts/2011_06_16_from_layout_to_animation/../2011_06_11_functional_prototype_evolution/end.png">
				<img src="/posts/2011_06_16_from_layout_to_animation/../2011_06_11_functional_prototype_evolution/end.png" style="height: 9em;"/>
			</a>
		</p>
		<p>
			Since the interface only displays navigation structures the question is how to integrate the actual contents.
			I.e. what should happen if the user clicks one of the links in the navigational interface, and how to get back from the content (e.g. blog article) to the navigation.
			Traditional websites reload the entire page every time a navigation link is clicked.
			My goal was to break this paradigm and introduce smoother transitions between displayed contents.
			However, there are many options to implement this requirement.
			In the following, two approaches are illustrated as YouTube videos.
		</p>
		<p style="text-align: center;">
			<iframe title="YouTube video player" width="48%" height="40%" src="//www.youtube.com/embed/3lPSM9JloI4?rel=0" frameborder="0" allowfullscreen="yes" style="margin-right: 10pt;">
				<!-- empty -->
			</iframe>
			<iframe title="YouTube video player" width="48%" height="40%" src="//www.youtube.com/embed/A64y9Hf3UNo?rel=0" frameborder="0" allowfullscreen="yes">
				<!-- empty -->
			</iframe>
		</p>
		<p>
			In the left approach the top header bar stays visible all the time.
			Getting back to the navigation simply requires clicking this top bar for the navigation contents to be slided in again.
			One disadvantage I felt this approach has is that the top bar always takes up unnecessary space.
			Therefore I worked on a second concept shown in the video to the right.
			Here navigation and content are two screens that are arranged horizontally.
			However, only one of the screens is displayed at a time and transition between them is animated as a slide effect.
			Consequently, less navigation-related content is displayed on the screen when reading e.g. a blog article.
		</p>
		<p>
			In future posts I'll try to understand the usability aspects of either approach and push the interface forward to an ultimately fun, effective, and efficient experience that is beyond traditional web interfaces.
		</p>
