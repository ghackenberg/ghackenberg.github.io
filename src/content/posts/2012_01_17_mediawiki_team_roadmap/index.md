---
title: "Managing Our Team Roadmap with MediaWiki"
pubDate: "2012-01-16"
description: "Recently, a few colleagues and I founded a working group around the topic of software engineering for future energy systems (also called smart grids). To coordi..."
tags: ["task-management", "hyperkit-software"]
icon: "/posts/2012_01_17_mediawiki_team_roadmap/editor.png"
---

The roadmap is basically a collection of current tasks and events.
The tasks are devided into four time frames:
(1) Immediate, (2) short term, (3) middle term and (4) long term.
Instead, the events are devided into three categories:
(1) Important, (2) prebooked and (3) publication deadlines.
Here is a screenshot:

[![](/posts/2012_01_17_mediawiki_team_roadmap/roadmap.png)](/posts/2012_01_17_mediawiki_team_roadmap/roadmap.png)

The layout of the roadmap is created with a simple MediaWiki table.
To keep the table code lightweight, the actual tasks and events are outsourced into template pages and included with the `{{PageName}}` syntax (highlighted in the following screenshot).

[![](/posts/2012_01_17_mediawiki_team_roadmap/editor.png)](/posts/2012_01_17_mediawiki_team_roadmap/editor.png)

Finally, the template pages cotain simple bullet point lists of the tasks or events in the given time frame or category respectively.
Typically we add links from the bullet points to extended information on the topic.
For example, the last entry in the following screenshot references an encrypted URL for another domain.

[![](/posts/2012_01_17_mediawiki_team_roadmap/template.png)](/posts/2012_01_17_mediawiki_team_roadmap/template.png)

Once a week we meet to update the common roadmap.
So far this strategy has proven worthwhile.
