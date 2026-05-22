---
title: "Optimizing Powerhouse Control"
pubDate: "2012-08-16"
description: "To meet the hard power balance contraint the use of conventional power plants and powerhouses is probably inevitable even in a smart grid. For this reason we ex..."
tags: ["dynamic programming","data visualization"]
icon: "/posts/2012_08_17_optimizing_powerhouse_control/balance.png"
---

<p>
			The system model defines 20 refrigerators, a solar plant and a powerhouse.
			The goal of exploration was to minimize the integral over the power balance.
			The first diagram depicts the obtained power balance curve after 96 time steps.
			Clearly, we achieve much better balance than in previous runs without an integrated powerhouse.
		</p>
		<p>
			<img src="/posts/2012_08_17_optimizing_powerhouse_control/balance.png" style="width: 100%;"/>
		</p>
		<p>
			The second charts depicts the available energy per time step.
			The curves for the solar panel and for the powerhouse are overlayed.
			Interestingly, the powerhouse truely stops producing when sun energy is high.
			Further, the powerhouse operates on average at around 1000 Watt.
			This is due to the fact that the model defines optimal efficiency for this value.
		</p>
		<p>
			<img src="/posts/2012_08_17_optimizing_powerhouse_control/sum.png" style="width: 100%;"/>
		</p>
		<p>
			In one of the next steps we will try to integrate this model with an energy storage to reduce usage of fossil energy sources.
		</p>
