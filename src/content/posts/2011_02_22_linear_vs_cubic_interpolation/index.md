---
title: "Linear vs. Cubic Interpolation"
pubDate: "2011-02-21"
description: "After talking with some non-computer scientists about my previous visualization of cubic interpolation I found out that the concept is difficult to understand i..."
tags: ["youtube video","data visualization"]
icon: "/posts/2011_02_22_linear_vs_cubic_interpolation/screenshot.png"
---

<p style="text-align: center;">
			<iframe title="YouTube video player" width="100%" height="80%" src="//www.youtube.com/embed/EMNpxfWo9go?rel=0" frameborder="0" allowfullscreen="yes">
				<!-- empty -->
			</iframe>
		</p>
		<p>
			To give a short explanation: Again the red dots represent measured data points, for example temperature, lightness, air pressure, etc.
			These measurements are distributed rather coarsly across the space, still we are interested in approximating values that lie inbetween.
			Obviously this approximation has to be based in some way on the actual measurements that have been taken.
			For example, linear interpolation assumes linear progression/degression between neighboring data points.
			Instead, cubic interpolation assumes a more complex formula while allowing for smoother interpolation results.
		</p>
		<p>
			In the end what you choose in your particular situation depends on many factors, i.e. even though being less impressive linear interpolation is used in a number of applications.
			One important reason certainly is the complexity of the formulas and the complexity of computing results respectively.
			Therefore you might think of the choice as a trade-off between quality and performance (although that might not be true for every case).	
		</p>
		<p>
			Still, with these articles I hope to encourage a discourse about information and computer science among a broader audience.
			Also, comments are always welcome!
		</p>
