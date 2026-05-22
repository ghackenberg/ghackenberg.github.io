---
title: "3D Motion Capture Documents from my PhD Studies at EPFL."
pubDate: "2012-04-26"
description: "Recently while browsing some folders on my hard disk I discovered relicts from my time in Lausanne, Switzerland. Somehow, for me this is an interesting and exci..."
tags: ["motion-capture"]
icon: "/posts/2012_04_27_motion_capture_documents/interface_list.png"
---

I was working on tracking (human) motion fast and with high quality.
We used a virtual skeleton and infrared markers.

[![](/posts/2012_04_27_motion_capture_documents/skeleton.png)](/posts/2012_04_27_motion_capture_documents/skeleton.png)

The overall tracking problem could be split in a number of subproblems:
Finding the configuration of the trunk, the hip and the shoulders.

[![](/posts/2012_04_27_motion_capture_documents/skeleton_trunk.png)](/posts/2012_04_27_motion_capture_documents/skeleton_trunk.png)
[![](/posts/2012_04_27_motion_capture_documents/skeleton_hip.png)](/posts/2012_04_27_motion_capture_documents/skeleton_hip.png)
[![](/posts/2012_04_27_motion_capture_documents/skeleton_shoulder.png)](/posts/2012_04_27_motion_capture_documents/skeleton_shoulder.png)

To improve the workflow I created software models of the skeleton.
For rendering I used [POV-Ray](http://www.povray.org/).

[![](/posts/2012_04_27_motion_capture_documents/povray_skeleton.png?width=400&height=500)](/posts/2012_04_27_motion_capture_documents/povray_skeleton.png)
[![](/posts/2012_04_27_motion_capture_documents/povray_markers.png)](/posts/2012_04_27_motion_capture_documents/povray_markers.png)
[![](/posts/2012_04_27_motion_capture_documents/povray_scene.png)](/posts/2012_04_27_motion_capture_documents/povray_scene.png)

Finally, I was working on an interface for testing the data structures and algorithms.
First I created some scetches.

[![](/posts/2012_04_27_motion_capture_documents/interface_scene.png)](/posts/2012_04_27_motion_capture_documents/interface_scene.png)
[![](/posts/2012_04_27_motion_capture_documents/interface_subject.png)](/posts/2012_04_27_motion_capture_documents/interface_subject.png)
[![](/posts/2012_04_27_motion_capture_documents/interface_list.png)](/posts/2012_04_27_motion_capture_documents/interface_list.png)

Then I implemented a prototype in [C++](http://en.wikipedia.org/wiki/C%2B%2B) and [Qt](http://qt.nokia.com/products/).
The prototype was based on a custom C++ plugin framework.

[![](/posts/2012_04_27_motion_capture_documents/screenshot.png)](/posts/2012_04_27_motion_capture_documents/screenshot.png)

In another article I might show you how the custom C++ plugin framework was implemented.
It was actually a very interesting experience for me, as plugin framework design turns out to be a challenging task.
