---
title: "Algorithm Debugging using OpenGL."
pubDate: "2009-07-20"
description: "Currently, I am working on my thesis in the area of Computer Vision. The algorithms are quite complex and difficult to debug. Therefore, I implemented a simple ..."
tags: ["data-visualization", "computer-vision"]
icon: "./interface.png"
---
First I want to give you an impression on how the debugger looks like.
The following screenshot shows the debugger setup for an applications which captures video streams from two connected USB cameras:

[![Single illustration from Algorithm Debugging using OpenGL.](./single.png)](./single.png)

The grid cells to the left show the original images captured from the video devices.
The next column shows the edge images for the original images, i.e. image data is reduced to locations where high color differences are found.
The final three columns show different types of histograms over the image data.
First, 1D histograms are calculated counting the intensity of colors in the images.
The 2D histograms show counts of normalized colors, i.e. the brightness of the pixels is factorized.
Finally, the 3D histograms to the right show counts of the individual colors of the RGB color space.
Each color is represented as a sphere.
The sphere is scaled according to the relative frequency of the respective color compared to the total number of pixels.

The example demonstrates different types of debuggers which I implemented for my master thesis.
Generally, debuggers have to inherit from the abstract base class `Debugger`.
The interface is shown in the following figure:

[![Interface illustration from Algorithm Debugging using OpenGL.](./interface.png)](./interface.png)

Basically, only a single virtual function has to be implemented: `draw`.
The function `draw` takes one argument, the side length of the cube which it renders to.
The task of the function is to render OpenGL primitives to the cube which is centered at `(0,0,0)`.
The framework takes care of moving the rendered content to the correct grid position.
Different types of debuggers my render very different contents to the cube, such as textured quads or colored spheres.
The content mainly depends on your application's requirements.

Finally, instances of the `Debugger` objects have to be added to the `screen`.
The `screen` provides a data structure for storing the debuggging grid and rendering the components.
The following figure shows how to add fill the screen:

[![Setup illustration from Algorithm Debugging using OpenGL.](./setup.png)](./setup.png)

Here, I use a loop for adding different layers of `Debugger` objects by alternating the `z`-coordinate.
For each debugger, the `x`, `y` and `z` coordinates of the target cell have to be specified.
There is no limitation for the values, i.e. the backend datastructure automatically scales to the given values.
Cells, for which no entry is given are left blank during rendering.

Finally, let's see what happens when we render five layers of the given debugger setup.
The result is given in the following screenshot:

[![Multiple illustration from Algorithm Debugging using OpenGL.](./multiple.png)](./multiple.png)

As you can see, the cells are replicated along the `z`-axis.
Alternatively, different types of debuggers could have been placed instead, i.e. my test case is a bit arbitrary.
But, the basic functionality of the system should be well demonstrated by now.

I hope, you like the idea and see potential for applying the framework in your applications.
I would also be happy to get feedback on how to improve or extend the system.

Have a great day!
