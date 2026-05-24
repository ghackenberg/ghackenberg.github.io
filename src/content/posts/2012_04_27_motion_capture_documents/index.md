---
title: "3D Motion Capture Documents from my PhD Studies at EPFL."
pubDate: "2012-04-26"
description: "Recently while browsing some folders on my hard disk I discovered relicts from my time in Lausanne, Switzerland. Somehow, for me this is an interesting and exci..."
tags: ["motion-capture"]
icon: "./interface_list.png"
---
I was working on tracking (human) motion fast and with high quality.
We used a virtual skeleton and infrared markers.

[![Skeleton illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton.png)](./skeleton.png)

The overall tracking problem could be split in a number of subproblems:
Finding the configuration of the trunk, the hip and the shoulders.

[![Skeleton trunk illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton_trunk.png)](./skeleton_trunk.png)
[![Skeleton hip illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton_hip.png)](./skeleton_hip.png)
[![Skeleton shoulder illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton_shoulder.png)](./skeleton_shoulder.png)

To improve the workflow I created software models of the skeleton.
For rendering I used [POV-Ray](http://www.povray.org/).

[![Povray skeleton illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./povray_skeleton.png)](./povray_skeleton.png)
[![Povray markers illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./povray_markers.png)](./povray_markers.png)
[![Povray scene illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./povray_scene.png)](./povray_scene.png)

Finally, I was working on an interface for testing the data structures and algorithms.
First I created some scetches.

[![Interface scene illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./interface_scene.png)](./interface_scene.png)
[![Interface subject illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./interface_subject.png)](./interface_subject.png)
[![Interface list illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./interface_list.png)](./interface_list.png)

Then I implemented a prototype in [C++](http://en.wikipedia.org/wiki/C%2B%2B) and [Qt](http://qt.nokia.com/products/).
The prototype was based on a custom C++ plugin framework.

[![Screenshot illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./screenshot.png)](./screenshot.png)

In another article I might show you how the custom C++ plugin framework was implemented.
It was actually a very interesting experience for me, as plugin framework design turns out to be a challenging task.
