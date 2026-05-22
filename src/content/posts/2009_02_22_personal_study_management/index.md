---
title: "Personal Study Management."
pubDate: "2009-02-21"
description: "Over my past years of study, I developed a system for organizing my learning. It helps me staying focused and having an overview over my progress. In this artic..."
tags: ["hyperkit-software", "data-visualization"]
icon: "/posts/2009_02_22_personal_study_management/plan.png"
---

<p>
			<a href="/posts/2009_02_22_personal_study_management/plan.png"><img src="/posts/2009_02_22_personal_study_management/plan.png" style="width: 50%; margin-left: 1em; margin-bottom: 1em; margin-right: 0.5em; margin-top: 0.5em;" align="right"/></a>
			The basic idea is, to have a table of the chapters, which have to be studied, their size and the overall percentage of progress after finishing it.
			In the picture to the right I have posted a schedule which I created for my <em>eLearning</em> exam last year.
			For this exam I had to study the production process for eLearning material.
			The production process is constituted of four main entities: the <em>analysis</em> where we have to find out what should be accomplished by introducing an eLearning system, the <em>conception</em> where we create an initial prototype for the system which can be verified by the customer, the <em>screenplay</em> which describes the eLearning system in its entire detail, and finally the <em>production</em> where the system is implemented for shipping.
			The plan provides me with the information of <em>how many slides</em> I have to read for each chapter.
			It also provides an accumulated view, i.e. the <em>sum over all preceeding chapters</em>.
			From this information we can calculate the <em>progress precentages</em>.
			The progress percentages help measuring and auditing your performance.
			Therefore, we also have a <em>status checkbox</em> to store your current progress.
			When finishing a chapter, I usually mark it as checked.
			Additionally, I write down the <em>key concepts and techniques</em>.
			They are meant to give a quick overview over the chapter's contents and guide you through the details.
		</p>
		<p>
			After having designed these learning plans by hand for each course separately over the past years, I decided to implement and automation script.
			The idea was to define the learning plan in <em>XML</em> and transform the information to a printable layout via <em>XSL</em>.
			The language I used for specifying layouts is <em>HTML</em>.
			Alternatively, one could use <em>XSL FO</em> having the advantage of being able to generate <em>PDF</em> files directly.
			But <em>HTML</em> did the trick for now.
		</p>
		<p style="clear: both;">
			Here is now the <em>XML</em> code which was used for specifying the <em>eLearning</em> learn plan from above:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_02_22_personal_study_management/xml.png"><img src="/posts/2009_02_22_personal_study_management/xml.png"/></a>
		</p>
		<p>
			As you can see, I can specify the course and its structure in terms of <em>chapters</em> and <em>sections</em>.
			For chapters and sections I can provide information about the number of pages.
			These will be used for accumulation and percentage calculation.
			Finally, I specify the <em>XML stylesheet</em> which has to be applied as a <em>XML processing instruction</em>.
			This allows for opening the <em>XML</em> file in the browser directly and getting the layout displayed.
		</p>
		<p>
			The stylesheet I cannot present in full length, as it covers around 150 lines of code.
			Most of the code is responsible for generating correct percentage number in different cases.
			Here is now a small excerpt:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_02_22_personal_study_management/xsl.png"><img src="/posts/2009_02_22_personal_study_management/xsl.png" style="width: 75%;"/></a>
		</p>
		<p>
			What you should basically take from this code listing is, that an <em>HTML</em> document is generated on the fly.
			For generating this document, I have to do mainly percentage calculations.
			These have to be derived from accumulated sums and nested structures.
			If you are interested in the full code, just ask me.
			I can provide it later.
		</p>
		<p>
			This was basically my technique for managing studies with a small tool chain which generates learning plans from <em>XML</em> descriptions.
			I hope you liked the presentation.
			Give me some feedback!
			Maybe there are some nice ways to improve this idea!
		</p>
