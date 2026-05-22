---
title: "3D Motion Capture Documents from my PhD Studies at EPFL."
pubDate: "2012-04-26"
description: "Recently while browsing some folders on my hard disk I discovered relicts from my time in Lausanne, Switzerland. Somehow, for me this is an interesting and exci..."
tags: ["motion capture"]
icon: "/posts/2012_04_27_motion_capture_documents/interface_list.png"
---

<p>
			I was working on tracking (human) motion fast and with high quality.
			We used a virtual skeleton and infrared markers.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_04_27_motion_capture_documents/skeleton.png" title="Skeleton drawing"><img src="/posts/2012_04_27_motion_capture_documents/skeleton.png" style="width: 60%;"/></a>
		</p>
		<p>
			The overall tracking problem could be split in a number of subproblems:
			Finding the configuration of the trunk, the hip and the shoulders.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_04_27_motion_capture_documents/skeleton_trunk.png" title="Trunk of the skeleton">
				<img src="/posts/2012_04_27_motion_capture_documents/skeleton_trunk.png" style="height: 13em; margin-right: 1em;"/>
			</a>
			<a href="/posts/2012_04_27_motion_capture_documents/skeleton_hip.png" title="Hip of the skeleton">
				<img src="/posts/2012_04_27_motion_capture_documents/skeleton_hip.png" style="height: 13em; margin-right: 1em;"/>
			</a>
			<a href="/posts/2012_04_27_motion_capture_documents/skeleton_shoulder.png" title="Shoulder of the skeleton">
				<img src="/posts/2012_04_27_motion_capture_documents/skeleton_shoulder.png" style="height: 13em;"/>
			</a>
		</p>
		<p>
			To improve the workflow I created software models of the skeleton.
			For rendering I used <a href="http://www.povray.org/">POV-Ray</a>.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_04_27_motion_capture_documents/povray_skeleton.png" title="Skeleton rendered with POV-Ray">
				<img src="/posts/2012_04_27_motion_capture_documents/povray_skeleton.png?width=400&amp;height=500" style="height: 13em; margin-right: 1em;"/>
			</a>
			<a href="/posts/2012_04_27_motion_capture_documents/povray_markers.png" title="Skeleton with markers rendered with POV-Ray">
				<img src="/posts/2012_04_27_motion_capture_documents/povray_markers.png" style="height: 13em; margin-right: 1em;"/>
			</a>
			<a href="/posts/2012_04_27_motion_capture_documents/povray_scene.png" title="Skeletons rendered onto walls in a scene">
				<img src="/posts/2012_04_27_motion_capture_documents/povray_scene.png" style="height: 13em;"/>
			</a>
		</p>
		<p>
			Finally, I was working on an interface for testing the data structures and algorithms.
			First I created some scetches.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_04_27_motion_capture_documents/interface_scene.png" title="User interface for browsing scenes">
				<img src="/posts/2012_04_27_motion_capture_documents/interface_scene.png" style="height: 13em; margin-right: 1em;"/>
			</a>
			<a href="/posts/2012_04_27_motion_capture_documents/interface_subject.png" title="User interface for browsing a subject">
				<img src="/posts/2012_04_27_motion_capture_documents/interface_subject.png" style="height: 13em; margin-right: 1em ;"/>
			</a>
			<a href="/posts/2012_04_27_motion_capture_documents/interface_list.png" title="User interface for browsing subjects">
				<img src="/posts/2012_04_27_motion_capture_documents/interface_list.png" style="height: 13em;"/>
			</a>
		</p>
		<p>
			Then I implemented a prototype in <a href="http://en.wikipedia.org/wiki/C%2B%2B">C++</a> and <a href="http://qt.nokia.com/products/">Qt</a>.
			The prototype was based on a custom C++ plugin framework.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_04_27_motion_capture_documents/screenshot.png" title="Screenshot of the prototype"><img src="/posts/2012_04_27_motion_capture_documents/screenshot.png" style="width: 100%;"/></a>
		</p>
		<p>
			In another article I might show you how the custom C++ plugin framework was implemented.
			It was actually a very interesting experience for me, as plugin framework design turns out to be a challenging task.  
		</p>
