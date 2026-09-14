---
title: "Getting Closer to Actual Balance"
pubDate: "2012-10-16"
description: "After extending our models and testing our tool chain we finally get some results that are really close to actual balance. The results are an important step tow..."
tags: ["data-visualization", "dynamic-programming", "energy-systems", "simulation"]
icon:
  src: "./level.png"
  title: "Getting Closer to Actual Balance - Level illustration"
  description: "Level illustration from Getting Closer to Actual Balance"
---
The underlying model contains a solar panel, an energy storage and 20 refrigerators.
The optimization starts at midnight with zero energy in the storage.
Therefore, until sunrise the energy balance is negative.
After sunrise the energy balance stabilizes around the zero point even across the following night and day.

![Power illustration from Getting Closer to Actual Balance](./power.png "Getting Closer to Actual Balance - Power illustration")

To understand the system behavior the following two diagrams show the average temperature and storage level over time.
Clearly, a temperature drop can be observed at day time while the storage level rises.
After sun power is gone the storage level drops to feed the refrigerators with energy.

![Temperature illustration from Getting Closer to Actual Balance](./temperature.png "Getting Closer to Actual Balance - Temperature illustration")

![Level illustration from Getting Closer to Actual Balance](./level.png "Getting Closer to Actual Balance - Level illustration")

In the next steps we plan to extend the model with other types of energy components.
Further, we are working on scaling the problem to village, city and country sizes.
