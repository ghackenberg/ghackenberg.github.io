---
title: "JavaScript Physics Simulation"
pubDate: "2011-04-13"
description: "Some time ago I was testing the capabilities of JavaScript and vector graphics toolkits such as SVG (Mozilla Firefox, Opera, Safari) and VML (Microsoft Internet..."
tags: ["youtube-video", "hyperkit-software", "zumida"]
icon: "/posts/2011_04_14_javascript_physics_simulation/bounce_four.png"
---

<iframe title="YouTube video player" src="//www.youtube.com/embed/pG4gF7uO_Sg?rel=0" frameborder="0" allowfullscreen="yes"></iframe>

The YouTube video is meant to demonstrate the simulation prototype both in Mozilla Firefox and Microsoft Internet Explorer.
The two version differ a little in that Microsoft IE additionally display the velocity of each ball as well as collision debug information.
It is however possible to make both versions identical.

In terms of the logic behind the scenes there are two interesting cases to highlight:
(1) The ball bouncing back from the ground and (2) two balls colliding with each other.
The bounce logic first checks if the position of the ball and its radius cause a collision with the ground.
If that is the case then the velocity of the ball is reflected across the horizontal ground line and due to friction the amount is dampened.
This phenomena is depicted in the following picture series:

![](/posts/2011_04_14_javascript_physics_simulation/bounce_one.png)
![](/posts/2011_04_14_javascript_physics_simulation/bounce_two.png)
![](/posts/2011_04_14_javascript_physics_simulation/bounce_three.png)
![](/posts/2011_04_14_javascript_physics_simulation/bounce_four.png)

The behavior in case of collisions between two separate balls is a little more complex than that.
If two balls collide the connecting line between the centers of the balls (orange line in the following picture series) defines a local coordinate system.
Now the velocities of both balls have to be converted into this local coordinate system.
The reason is that this conversion reveals (1) the velocity component that is influenced by the collision and (2) the velocity component that is independent.
The first component is parallel to the orange line, the second component is orthogonal.
Next the influenced component is changed according to the laws of impulse, i.e. including the relative masses and velocities of the balls.
And finally the first and the second component have to be added again to obtain the new velocity of each ball.
The effect of this procedure is visualized in the following picture series.
Blue lines depict the components of the new velocities.

![](/posts/2011_04_14_javascript_physics_simulation/collision_one.png)
![](/posts/2011_04_14_javascript_physics_simulation/collision_two.png)
![](/posts/2011_04_14_javascript_physics_simulation/collision_four.png)

If I find the time I will also make sure to compile a package of the prototype for download.
So far it is just a bunch of files lying around on the hard disk.
In particular there are also dependencies on proprietary JavaScript libraries which have to be resolved properly.
Nevertheless I hope this is something of interest for you.
