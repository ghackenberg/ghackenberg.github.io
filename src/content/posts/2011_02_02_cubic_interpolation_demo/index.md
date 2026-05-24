---
title: "3D Cubic Interpolation Video"
pubDate: "2011-02-01"
description: "Cubic interpolation is a popular technique in many branches of computer science. For example, it is used when having a time series of numbers and estimating the..."
tags: ["youtube-video", "data-visualization"]
icon: "./screenshot.png"
---
<iframe title="YouTube video player" src="//www.youtube.com/embed/D4REuPPg4o4?rel=0" frameborder="0" allowfullscreen="yes"></iframe>

In the above visualization the colors of the 3D points have a specific meaning, which is explained in the following table:

| Color | Description | Example |
| :--- | :--- | :--- |
| <span class="font-bold text-red-500">Red</span> | Measured data point | Measured brightness of pixel `(x,y)` in a digital image |
| <span class="font-bold text-green-500">Green</span> | Interpolated data point along one axis | Estimated brightness between pixel `(x,y)` and `(x+1,y)` <br> <span class="text-xs text-gray-400">Note the change only along the `x` dimension!</span> |
| <span class="font-bold text-blue-500">Blue</span> | Interpolated data point along two axes | Estimated brightness between pixel `(x,y)` and `(x+1,y+1)` <br> <span class="text-xs text-gray-400">Note the change both along the `x` and the `y` dimension!</span> |

The math behind the visualiuation is explained in the Wikipedia articles [Cubic interpolation](http://en.wikipedia.org/wiki/Cubic_interpolation) and [Bicubic interpolation](http://en.wikipedia.org/wiki/Bicubic_interpolation).
The concept of *bicubic interpolation* hereby refers to problems with two input variables, such as the `x` and `y` dimensions in the above example.
In these cases the basic cubic interpolation method is applied two times in a row, first along the `x` dimension using measured samples, then along the `y` dimension using the previously obtained estimates.
The details of this procedure a well explained in the corresponding Wikipedia entries.

What you should probably take from this article are two things:
(1) a visual understanding of cubic interpolation and (2) a feeling for when this method is applicable.
Also, if questions are open please do not hesitate to ask, and I will try to make my best to eliminate all certainties `;)`.
