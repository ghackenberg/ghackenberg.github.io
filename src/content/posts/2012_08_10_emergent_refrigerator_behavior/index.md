---
title: "True Emergent Refrigerator Behavior"
pubDate: "2012-08-09"
description: "We are moving towards larger scale problems! In the past we worked on modeling, optimizing and exploring behavior of up to 20 refrigerators. Computational bound..."
tags: ["dynamic-programming", "data-visualization"]
icon: "/posts/2012_08_10_emergent_refrigerator_behavior/diagram.png"
---

To demonstrate this claim we prepared a study with varying number of refrigerators.
The goal of refrigerator behavior is to use as much solar energy as possible minimizing the additional load on the network.
The available solar energy is scaled linearly by the number of refrigerators.
For small problem classes (up to five refrigerators) we are able to calculate the optimal behavior.
For larger problem classes we introduce some form of coordination between refrigerators which tries to minimize the knowledge communicated between components.
The following diagram shows the costs of the selected behavior relative to the number of refrigerators in the model.
Clearly the cost drop with increasing number of refrigerators since the solar energy curve can be approximated better.
Still we observe an increase for 1000 and 5000 refrigerators.
This increase is due to the percentage of the exponential search space that we can practically explore.
Nevertheless the costs behave well considering that the results are calculated extremely fast!

![](/posts/2012_08_10_emergent_refrigerator_behavior/diagram.png)
