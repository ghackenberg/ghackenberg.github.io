---
title: "Manufacturing systems case study completed!"
pubDate: "2015-11-18"
description: "It took me the whole year to develop a software, which implements the cross-discipline manufacturing systems modeling and consistency checking technique I propo..."
tags: ["manufacturing-engineering"]
icon: "/posts/2015_11_19_case_study_complete/pick_and_place_unit.png"
---

<p>
			The case study is based on the <a href="https://www.ais.mw.tum.de/en/research/equipment/ppu/" target="_blank">pick and place unit demonstrator</a> developed at the <a href="https://www.ais.mw.tum.de/en/homepage/" target="_blank">Institute for Automation and Information Systems, Prof. Dr.-Ing. Birgit Vogel-Heuser, Technische Universitaet Muenchen</a>.
			The following screenshot shows the model of the pick and place unit, which has been developed using the prototypical tooling proposed in my dissertation work.
			In particular, the screenshot shows the decomposition of the system into modules (middle left view) as well as the geometric structure of the system (middle right view).
			The modules are the distributor, the stamper, and the sorter each serving a different purpose during system operation.
			The distributor is responsible for distributing workpieces to the other two modules, the stamper is responsible for stamping workpieces, and the sorter is reponsible for sorting workpieces.
		</p>
		<p>
			<a href="/posts/2015_11_19_case_study_complete/pick_and_place_unit.png">
				<img src="/posts/2015_11_19_case_study_complete/pick_and_place_unit.png?width=1000" style="width: 100%;"/>
			</a>
		</p>
		<p>
			One key feature of the modeling technique is the decomposition of manufacturing systems into mechatronic modules and components.
			In particular, mechatronic modules and components can be engineered in parallel and tested individually, which speeds up system development.
			To achieve this feature, mechatronic modules and components define their own geometric structure and behavior.
			Also, mechatronic modules and components can be decomposed further leading to arbitrary decomposition structures.
			The following screenshots show the geometric structure of the distributor module, the stamper module, and the sorter module.
			Note that these geometric structures can be seen also in the geometric structure of the overall system.
		</p>
		<p>
			<a href="/posts/2015_11_19_case_study_complete/pick_and_place_unit_crane.png">
				<img src="/posts/2015_11_19_case_study_complete/pick_and_place_unit_crane.png?width=500" style="float: left; width: 32%; margin-right: 2%;"/>
			</a>
			<a href="/posts/2015_11_19_case_study_complete/pick_and_place_unit_stamp.png">
				<img src="/posts/2015_11_19_case_study_complete/pick_and_place_unit_stamp.png?width=500" style="float: left; width: 32%; margin-right: 2%;"/>
			</a>
			<a href="/posts/2015_11_19_case_study_complete/pick_and_place_unit_conveyor.png">
				<img src="/posts/2015_11_19_case_study_complete/pick_and_place_unit_conveyor.png?width=500" style="float: left; width: 32%;"/>
			</a>
			<br clear="all"/>
		</p>
		<p>
			Another key feature of the modeling technique is the support for both geometric structure and behavior.
			The geometric structure is developed typically using <a href="https://en.wikipedia.org/wiki/Computer-aided_design" target="_blank">computer aided design software</a>.
			While computer aided design software provides powerful tools for geometry editing, the system behavior cannot be captured.
			The behavior is developed typically using <a href="https://en.wikipedia.org/wiki/Integrated_development_environment" target="_blank">integrated development environments</a>.
			While integrated development environments provide powerful tools for behavior editing, the system geometry cannot be captured.
			Consequently, the consistency of the geometric structure and the behavior cannot be checked efficiently.
			The novel technique proposed in my dissertation work integrates geometry and behavior such that automatic consistency checking is made possible.
			The geometric structure has been shown in the previous screenshots, while examples of behavior are shown in the following screenshots.
			In particular, the following screenshots show the software controllers of the distributor module, the stamper module, and the sorter module.
			As typical for many other modeling techniques, the controller behavior is modeled using a variant of <a href="https://en.wikipedia.org/wiki/Finite-state_machine" target="_blank">finite state machines</a>.
		</p>
		<p>
			<a href="/posts/2015_11_19_case_study_complete/pick_and_place_unit_crane_controller.png">
				<img src="/posts/2015_11_19_case_study_complete/pick_and_place_unit_crane_controller.png?width=500" style="float: left; width: 32%; margin-right: 2%;"/>
			</a>
			<a href="/posts/2015_11_19_case_study_complete/pick_and_place_unit_stamp_controller.png">
				<img src="/posts/2015_11_19_case_study_complete/pick_and_place_unit_stamp_controller.png?width=500" style="float: left; width: 32%; margin-right: 2%;"/>
			</a>
			<a href="/posts/2015_11_19_case_study_complete/pick_and_place_unit_conveyor_controller.png">
				<img src="/posts/2015_11_19_case_study_complete/pick_and_place_unit_conveyor_controller.png?width=500" style="float: left; width: 32%;"/>
			</a>
			<br clear="all"/>
		</p>
		<p>
			Currently, we are working on a video demonstrating the tool and its features.
			We are also thinking about releasing the prototypical tooling under some appropriate license.
			If you are interested, let me know!!
		</p>
