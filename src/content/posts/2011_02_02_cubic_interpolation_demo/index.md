---
title: "3D Cubic Interpolation Video"
pubDate: "2011-02-01"
description: "Cubic interpolation is a popular technique in many branches of computer science. For example, it is used when having a time series of numbers and estimating the..."
tags: ["youtube-video", "data-visualization"]
icon: "/posts/2011_02_02_cubic_interpolation_demo/screenshot.png"
---

<p style="text-align: center;">
			<iframe title="YouTube video player" class="youtube-player" type="text/html" width="100%" height="80%" src="//www.youtube.com/embed/D4REuPPg4o4?rel=0" frameborder="0" allowFullScreen="yes">
				<!-- empty -->
			</iframe>
		</p>
		<p>
			In the above visualization the colors of the 3D points have a specific meaning, which is explained in the following table:
		</p>
		<table class="default">
			<thead>
				<tr>
					<th>Color</th>
					<th>Description</th>
					<th>Example</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td style="font-weight: bold; color: red;">Red</td>
					<td>Measured data point</td>
					<td>Measured brightness of pixel <code>(x,y)</code> in a digital image</td>
				</tr>
				<tr>
					<td style="font-weight: bold; color: green;">Green</td>
					<td>Interpolated data point along one axis</td>
					<td>Estimated brightness between pixel <code>(x,y)</code> and <code>(x+1,y)</code><br/><span style="color: gray;">Note the change only along the <code>x</code> dimension!</span></td>
				</tr>
				<tr>
					<td style="font-weight: bold; color: blue;">Blue</td>
					<td>Interpolated data point along two axes</td>
					<td>Estimated brightness between pixel <code>(x,y)</code> and <code>(x+1,y+1)</code><br/><span style="color: gray;">Note the change both along the <code>x</code> and the <code>y</code> dimension!</span></td>
				</tr>
			</tbody>
		</table>
		<p>
			The math behind the visualiuation is explained in the Wikipedia articles <a class="web" href="http://en.wikipedia.org/wiki/Cubic_interpolation">Cubic interpolation</a> and <a class="web" href="http://en.wikipedia.org/wiki/Bicubic_interpolation">Bicubic interpolation</a>.
			The concept of <em>bicubic interpolation</em> hereby refers to problems with two input variables, such as the <code>x</code> and <code>y</code> dimensions in the above example.
			In these cases the basic cubic interpolation method is applied two times in a row, first along the <code>x</code> dimension using measured samples, then along the <code>y</code> dimension using the previously obtained estimates.
			The details of this procedure a well explained in the corresponding Wikipedia entries.
		</p>
		<p>
			What you should probably take from this article are two things:
			(1) a visual understanding of cubic interpolation and (2) a feeling for when this method is applicable.
			Also, if questions are open please do not hesitate to ask, and I will try to make my best to eliminate all certainties <code>;)</code>.
		</p>
