---
title: "3D Multi-Touch with Computer Vision"
pubDate: "2011-07-13"
description: "Some time ago I was working on free hand 3D gesture interfaces similar to Microsoft Kinect. What this work essentially means is collecting digital camera images..."
tags: ["motion capture","gesture recognition","computer vision","user interface"]
icon: "/posts/2011_07_14_3dmt_computer_vision/candidates.png"
---

<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/regions.png"><img src="/posts/2011_07_14_3dmt_computer_vision/regions.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>first</strong> visualization illustrates how the original image contents are segmented into regions of consistent depth.
			This segmentation is used to find those pixels that are interesting for further processing steps thereby limiting the complexity of the input to the algorithm.
			<br clear="both"/>
		</p>
		<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/distances.png"><img src="/posts/2011_07_14_3dmt_computer_vision/distances.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>second</strong> visualization illustrates the process of calculating for each pixel the distance to the closest depth discontinuity.
			The idea of this step is to find candidates for palms as pixels with the largest distance (equal to the white spots in the visualization).
			<br clear="both"/>
		</p>
		<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/tips.png"><img src="/posts/2011_07_14_3dmt_computer_vision/tips.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>third</strong> visualization illustrates the process of finding candidates for finger tips in the image.
			Constructing this process has been one of the main contributions of my work.
			Explaining the details would go into mathematical details, which I believe are not interesting at this point.	
			<br clear="both"/>
		</p>
		<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/pipes.png"><img src="/posts/2011_07_14_3dmt_computer_vision/pipes.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>fourth</strong> visualization illustrates the process of finding the fingers (or finger pipes as we call it) in the image.
			The process is similar to finding finger tips and I believe the same argument holds for not explaining the details of this visualization.
			<br clear="both"/>
		</p>
		<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/topologies.png"><img src="/posts/2011_07_14_3dmt_computer_vision/topologies.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>fifth</strong> visualization illustrates the process of estimating the skeleton of the objects that are visible in the camera image.
			This approximate skeleton provides valuable information when it comes to classifying the actual palm locations by confining the search to topology endpoints.
			<br clear="both"/>
		</p>
		<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/fingers.png"><img src="/posts/2011_07_14_3dmt_computer_vision/fingers.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>sixth</strong> visualization illustrates the process of extracting finger-like structures from the image contents.
			Each of the selected finger structures is annotated on top of the depth image using two green circles (for tip and base) connected by a green line.
			<br clear="both"/>
		</p>
		<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/candidates.png"><img src="/posts/2011_07_14_3dmt_computer_vision/candidates.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>seventh</strong> visualization illustrates the process of grouping various image features to candidates for the hand recognition and tracking step.
			Each candidate is annotated using the palm circle and finger structure annotations from the previous step, all in random color.
			<br clear="both"/>
		</p>
		<p>
			<a href="/posts/2011_07_14_3dmt_computer_vision/tracking.png"><img src="/posts/2011_07_14_3dmt_computer_vision/tracking.png" align="left" style="width: 200pt; margin-right: 10pt;"/></a>
			This <strong>eighth</strong> visualization illustrates the process of tracking hand appearances over time across the image plane.
			The current location of the palm is annotated with a green circle, while the locations in the previous frames are annotated through a green line.
			Finally, the red top of the line is the prediction for the current frame calculated from the previous motion.
			<br clear="both"/>
		</p>
		<p>
			What I wanted to show with this article is how visualization can make a problem/solution/system more comprehensible.
			The visualizations provided in this article have a concrete practical background as they were taken from my Master thesis compendium.
			Further, the computer vision domain lends itself to a fairly natural and intuitive class of visualizations constructed from the original image contents.
			This class might not be available in every domain, in particular the more abstract and theoretical ones.
			However, I believe there is almost always an added value in drawing a picture about something, especially when you don't have a clear picture about it in your head.
		</p>
