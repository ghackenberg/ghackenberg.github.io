---
title: "Sample System Model (Graph Output)"
pubDate: "2012-08-13"
description: "To demonstrate the models we are working with here is some sample output from our tool. The engine transforms structural model information in a custom graph for..."
tags: ["dynamic-programming", "data-visualization"]
icon: "./graph.png"
---
The semantics behind the graph visualization is as follows:
Nodes represent system components and observations.
Components have a link to their parent components (child components respectively).
Observations have a link to their declaring component.
Further edges show the influence relationship between components.
Now try to make sense out of the following mess:

![Graph illustration from Sample System Model (Graph Output)](./graph.png)

If you have questions do not hesitate to ask me!
This is just early outcome from our simulation/exploration framework.
We are working to make it better...
