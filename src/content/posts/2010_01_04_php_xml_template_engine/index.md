---
title: "XML Template Engine using PHP."
pubDate: "2010-01-03"
description: "After the success of JSP and JSP tag libraries in the Java world, I was searching for a similar mechanism in PHP. Since the search was not successful and I shar..."
tags: ["hyperkit-software"]
icon: "/posts/2010_01_04_php_xml_template_engine/sample.png"
---

In this article I demonstrate how to use the engine for developing a simple page template for regular websites.
Then I show how to extend the functionality of the system using the proprietary interface specification (which is not final at the current stage).
To get started, let's first have a look at a simple sample template which has been developed for testing the first engine prototype.
Notice, that some code fragments use a new content management framework which I will dedicate an own article later this year.

[![](/posts/2010_01_04_php_xml_template_engine/sample.png)](/posts/2010_01_04_php_xml_template_engine/sample.png)

The first thing that springs into the eye is, that we are generating regular HTML content with this template by means of the root element `html`.
The element also hosts a namespace definition which provides the link with the templating mechanism: `xmlns:code`.
The so-called namespace URI, i.e. the value of the namespace attribute, uses the prefix `php:` which tells the engine that elements of this namespace will be routed through the given class.
In our case, we are referring to a general `Tags` class which I intend to ship with the final system.

When running the template engine with the given template definition, all nodes will be copied from the source to the target document except the `code` elements.
Each `code:...` will be translated into a static function call on the `Tags` class.
The convention is that a `code:name` will be converted into the method name `Tags:processName` where the first letter of the tagname is capitalized.
The following figure shows the interface of the current `Tags` class:

[![](/posts/2010_01_04_php_xml_template_engine/tags.png)](/posts/2010_01_04_php_xml_template_engine/tags.png)

First, let's discuss the function signatures which are the same in all cases.
Each function retrieves a pointer to the target document for creating nodes and other `DOM`-related tasks.
Additionally, a reference to the current parent node in the target document is passed for appending new content.
The actual template node that was responsible for triggering the call can be access via the `node` parameter.
A reference to this node is necessary, e.g. for accessing the attributes and children of the node.
As an example, most functions use the attribute `expression` for evaluating some PHP code and processing the result.
Finally, a the arrays `parameters` and `variables` are provided in the current implementation.
These are meant to host named objects either scoped in the `parameter`'s case and global in the `variable`'s case.
They are for example used to pass parameters to the template when starting the execution.

The last thing you should notice is the `Template::processChildren` call.
The class `Template` provides the basic implementation of the template engine.
It offers `process` methods for traversing the template `DOM` tree, copying contents to the target document and calling extensions.
This also means, that tags which allow nested content should direct control back to the `Template` class at some point.
This is for example done in case of the `code:if` tag respectively `Tags::processIf` static method.
The method starts traversing the content if and only if the value of the `expression` script returned something `true`.
The language you can use in all `expression` attributes is PHP.
This is a nice advantage over related approaches where different languages are used for implementation, scripting, etc.

I hope, you liked the demonstration.
If you need the code for testing the system please let me know.
I am willing to email you if you ask nicely `:)`.
