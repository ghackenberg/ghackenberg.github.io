---
title: "Managing Our Team Roadmap with MediaWiki"
pubDate: "2012-01-16"
description: "Recently, a few colleagues and I founded a working group around the topic of software engineering for future energy systems (also called smart grids). To coordi..."
tags: ["task management","hyperkit software"]
icon: "/posts/2012_01_17_mediawiki_team_roadmap/editor.png"
---

<p>
			The roadmap is basically a collection of current tasks and events.
			The tasks are devided into four time frames:
			(1) Immediate, (2) short term, (3) middle term and (4) long term.
			Instead, the events are devided into three categories:
			(1) Important, (2) prebooked and (3) publication deadlines.
			Here is a screenshot:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_17_mediawiki_team_roadmap/roadmap.png"><img src="/posts/2012_01_17_mediawiki_team_roadmap/roadmap.png" style="width: 100%;"/></a>
		</p>
		<p>
			The layout of the roadmap is created with a simple MediaWiki table.
			To keep the table code lightweight, the actual tasks and events are outsourced into template pages and included with the <code>{{PageName}}</code> syntax (highlighted in the following screenshot).
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_17_mediawiki_team_roadmap/editor.png"><img src="/posts/2012_01_17_mediawiki_team_roadmap/editor.png" style="width: 60%;"/></a>
		</p>
		<p>
			Finally, the template pages cotain simple bullet point lists of the tasks or events in the given time frame or category respectively.
			Typically we add links from the bullet points to extended information on the topic.
			For example, the last entry in the following screenshot references an encrypted URL for another domain.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_17_mediawiki_team_roadmap/template.png"><img src="/posts/2012_01_17_mediawiki_team_roadmap/template.png" style="width: 30%;"/></a>
		</p>
		<p>
			Once a week we meet to update the common roadmap.
			So far this strategy has proven worthwhile.
		</p>
