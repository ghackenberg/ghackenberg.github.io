---
title: "3D Motion Capture Documents from my PhD Studies at EPFL."
pubDate: "2012-04-26"
description: "Recently while browsing some folders on my hard disk I discovered relicts from my time in Lausanne, Switzerland. Somehow, for me this is an interesting and exci..."
tags: ["computer-vision", "gesture-recognition", "motion-capture"]
icon:
  src: "./interface_list.png"
  title: "3D Motion Capture Documents from my PhD Studies at EPFL - Interface list illustration"
  description: "Interface list illustration from 3D Motion Capture Documents from my PhD Studies at EPFL."
---
I was working on tracking (human) motion fast and with high quality.
We used a virtual skeleton and infrared markers.

[![Skeleton illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton.png "3D Motion Capture Documents from my PhD Studies at EPFL - Skeleton illustration")](./skeleton.png)

The overall tracking problem could be split in a number of subproblems:
Finding the configuration of the trunk, the hip and the shoulders.

[![Skeleton trunk illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton_trunk.png "3D Motion Capture Documents from my PhD Studies at EPFL - Skeleton trunk illustration")](./skeleton_trunk.png)
[![Skeleton hip illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton_hip.png "3D Motion Capture Documents from my PhD Studies at EPFL - Skeleton hip illustration")](./skeleton_hip.png)
[![Skeleton shoulder illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./skeleton_shoulder.png "3D Motion Capture Documents from my PhD Studies at EPFL - Skeleton shoulder illustration")](./skeleton_shoulder.png)

To improve the workflow I created software models of the skeleton.
For rendering I used [POV-Ray](http://www.povray.org/).

[![Povray skeleton illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./povray_skeleton.png "3D Motion Capture Documents from my PhD Studies at EPFL - Povray skeleton illustration")](./povray_skeleton.png)
[![Povray markers illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./povray_markers.png "3D Motion Capture Documents from my PhD Studies at EPFL - Povray markers illustration")](./povray_markers.png)
[![Povray scene illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./povray_scene.png "3D Motion Capture Documents from my PhD Studies at EPFL - Povray scene illustration")](./povray_scene.png)

Finally, I was working on an interface for testing the data structures and algorithms.
First I created some scetches.

[![Interface scene illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./interface_scene.png "3D Motion Capture Documents from my PhD Studies at EPFL - Interface scene illustration")](./interface_scene.png)
[![Interface subject illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./interface_subject.png "3D Motion Capture Documents from my PhD Studies at EPFL - Interface subject illustration")](./interface_subject.png)
[![Interface list illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./interface_list.png "3D Motion Capture Documents from my PhD Studies at EPFL - Interface list illustration")](./interface_list.png)

Then I implemented a prototype in [C++](http://en.wikipedia.org/wiki/C%2B%2B) and [Qt](http://qt.nokia.com/products/).
The prototype was based on a custom C++ plugin framework.

[![Screenshot illustration from 3D Motion Capture Documents from my PhD Studies at EPFL.](./screenshot.png "3D Motion Capture Documents from my PhD Studies at EPFL - Screenshot illustration")](./screenshot.png)

In another article I might show you how the custom C++ plugin framework was implemented.
It was actually a very interesting experience for me, as plugin framework design turns out to be a challenging task.

*Historical Archive (2009–2017):* [← Previous: Software logo sketches with graphics tablet/pen.](/posts/2012_04_24_software_logo_tablet_pen_sketches/) | [Next: Leaving to ICSE tomorrow! →](/posts/2012_05_31_leaving_to_icse_tomorrow/)
