---
title: "XML Template Engine using PHP."
pubDate: "2010-01-03"
description: "After the success of JSP and JSP tag libraries in the Java world, I was searching for a similar mechanism in PHP. Since the search was not successful and I shar..."
tags: ["hyperkit-software"]
icon: "/posts/2010_01_04_php_xml_template_engine/sample.png"
---

<p>
			In this article I demonstrate how to use the engine for developing a simple page template for regular websites.
			Then I show how to extend the functionality of the system using the proprietary interface specification (which is not final at the current stage).
			To get started, let's first have a look at a simple sample template which has been developed for testing the first engine prototype.
			Notice, that some code fragments use a new content management framework which I will dedicate an own article later this year.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2010_01_04_php_xml_template_engine/sample.png"><img src="/posts/2010_01_04_php_xml_template_engine/sample.png" style="max-width: 85%;"/></a>
		</p>
		<p>
			The first thing that springs into the eye is, that we are generating regular HTML content with this template by means of the root element <code>html</code>.
			The element also hosts a namespace definition which provides the link with the templating mechanism: <code>xmlns:code</code>.
			The so-called namespace URI, i.e. the value of the namespace attribute, uses the prefix <code>php:</code> which tells the engine that elements of this namespace will be routed through the given class.
			In our case, we are referring to a general <code>Tags</code> class which I intend to ship with the final system.
		</p>
		<p>
			When running the template engine with the given template definition, all nodes will be copied from the source to the target document except the <code>code</code> elements.
			Each <code>code:...</code> will be translated into a static function call on the <code>Tags</code> class.
			The convention is that a <code>code:name</code> will be converted into the method name <code>Tags:processName</code> where the first letter of the tagname is capitalized.
			The following figure shows the interface of the current <code>Tags</code> class:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2010_01_04_php_xml_template_engine/tags.png"><img src="/posts/2010_01_04_php_xml_template_engine/tags.png" style="max-width: 85%;"/></a>
		</p>
		<p>
			First, let's discuss the function signatures which are the same in all cases.
			Each function retrieves a pointer to the target document for creating nodes and other <code>DOM</code>-related tasks.
			Additionally, a reference to the current parent node in the target document is passed for appending new content.
			The actual template node that was responsible for triggering the call can be access via the <code>node</code> parameter.
			A reference to this node is necessary, e.g. for accessing the attributes and children of the node.
			As an example, most functions use the attribute <code>expression</code> for evaluating some PHP code and processing the result.
			Finally, a the arrays <code>parameters</code> and <code>variables</code> are provided in the current implementation.
			These are meant to host named objects either scoped in the <code>parameter</code>'s case and global in the <code>variable</code>'s case.
			They are for example used to pass parameters to the template when starting the execution.
		</p>
		<p>
			The last thing you should notice is the <code>Template::processChildren</code> call.
			The class <code>Template</code> provides the basic implementation of the template engine.
			It offers <code>process</code> methods for traversing the template <code>DOM</code> tree, copying contents to the target document and calling extensions.
			This also means, that tags which allow nested content should direct control back to the <code>Template</code> class at some point.
			This is for example done in case of the <code>code:if</code> tag respectively <code>Tags::processIf</code> static method.
			The method starts traversing the content if and only if the value of the <code>expression</code> script returned something <code>true</code>.
			The language you can use in all <code>expression</code> attributes is PHP.
			This is a nice advantage over related approaches where different languages are used for implementation, scripting, etc.
		</p>
		<p>
			I hope, you liked the demonstration.
			If you need the code for testing the system please let me know.
			I am willing to email you if you ask nicely <code>:)</code>.
		</p>
