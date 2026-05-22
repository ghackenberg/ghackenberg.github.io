---
title: "Revised PHP/XML Blog Implementation"
pubDate: "2012-01-03"
description: "After another year of up-time it was time to revise some parts of the blog implementation. Originally, I did not pay much attention to the file structure. Howev..."
tags: ["blog", "data-visualization"]
icon: "/posts/2012_01_04_revised_php_xml_blog_implementation/content.png"
---

<p>
			The files of the blog are distributed to six folders:
			(1) <strong>content</strong> stores variable data for each blog installation,
			(2) <strong>controller</strong> contains PHP scripts that descide how to process HTTP requests,
			(3) <strong>model</strong> contains PHP classes that reflect the content,
			(4) <strong>script</strong> contains JavaScripts required by the user interface,
			(5) <strong>theme</strong> contains Cascading Stylesheets and images for the user interface,
			and (6) <strong>view</strong> contains PHP scripts that generate the HTTP responses.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_04_revised_php_xml_blog_implementation/main_folders.png">
				<img src="/posts/2012_01_04_revised_php_xml_blog_implementation/main_folders.png" style="width: 60%;"/>
			</a>
		</p>
		<p>
			The <strong>content</strong> folder mainly contains the <strong>article</strong> folder, which stores the individual blog articles.
			Each blog article is represented by a folder whose name contains the article <strong>date</strong> and <strong>id</strong> (e.g. <code>2009_02_11_personal_website_launched</code>).
			This folder contains the <strong>article.xml</strong> file and other documents such as images or PDFs.
			The XML file provides information about the article <strong>headline</strong>, <strong>tagline</strong> and <strong>content</strong>.
			Typically, the <strong>content</strong> section refers to the attached documents.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_04_revised_php_xml_blog_implementation/content.png">
				<img src="/posts/2012_01_04_revised_php_xml_blog_implementation/content.png" style="width: 100%;"/>
			</a>
		</p>
		<p>
			The <strong>controller</strong> folder currently only contains a single script called <strong>main.php</strong>.
			The purpose of the script is to load the content using the <strong>model</strong> classes and to redirect the HTTP request to the respective <strong>view</strong>.
			Further, for raw content such as images or PDF documents the correct file path is derived using a <strong>base</strong> path and the request URL. 
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_04_revised_php_xml_blog_implementation/controller.png">
				<img src="/posts/2012_01_04_revised_php_xml_blog_implementation/controller.png" style="width: 60%;"/>
			</a>
		</p>
		<p>
			The <strong>model</strong> folder currently contains three classes:
			(1) <strong>Database</strong> represents the root of the content model,
			(2) <strong>Article</strong> represents a blog article with direct access to headlines, taglines, content and attached documents,
			and (3) <strong>File</strong> represents attached documents.
			The class implementations typically use file system operations and the <em>SimpleXML API</em> for loading the stored content.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_04_revised_php_xml_blog_implementation/model.png">
				<img src="/posts/2012_01_04_revised_php_xml_blog_implementation/model.png" style="width: 45%;"/>
			</a>
		</p>
		<p>
			The <strong>script</strong> folder currently contains JavaScript files for
			(1) the Dashboard image slideshow and
			(2) the four different blog interfaces (Calendar, Cover, Tile, Timeline).
			Scripts (and <strong>theme</strong>) are separated from <strong>content</strong> to make it possible to exchange content while keeping appearance and interactivity.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_04_revised_php_xml_blog_implementation/script.png">
				<img src="/posts/2012_01_04_revised_php_xml_blog_implementation/script.png" style="width: 20%;"/>
			</a>
		</p>
		<p>
			The <strong>theme</strong> folder contains (1) images and (2) Cascading Stylesheets.
			Through separating theme files from content it is possible to have several blog installations run the same theme with different content.
			It is intended to install themes by checking out a respective theme SVN repository.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_04_revised_php_xml_blog_implementation/theme.png">
				<img src="/posts/2012_01_04_revised_php_xml_blog_implementation/theme.png" style="width: 30%;"/>
			</a>
		</p>
		<p>
			The <strong>view</strong> folder currently contains scripts for
			(1) the <strong>header</strong> and <strong>footer</strong> (reused by other views),
			(2) the <strong>index</strong> (also called <em>Dashboard</em>) and <strong>article</strong> pages,
			(3) the <strong>RSS feed</strong>,
			and (4) the <strong>error</strong> page.
			Further, scripts are provided for specific files extensions such as <strong>JPEG</strong> or <strong>PDF</strong>.
			In particular, the image extension scripts provide functionality to rescale and crop image files.
			Finally, the folder <strong>interface</strong> contains the views for the different blog interfaces (Calendar, Cover, Tile, Timeline).
		</p>
		<p style="text-align: center;">
			<a href="/posts/2012_01_04_revised_php_xml_blog_implementation/view.png">
				<img src="/posts/2012_01_04_revised_php_xml_blog_implementation/view.png" style="width: 100%;"/>
			</a>
		</p>
		<p>
			These files are currently all that is required for running a simple PHP/XML blog.
			If you are interested you can access the entire sources via the public SVN repository: <a class="web" href="http://svn.hyperkit-software.com/personalblog/">http://svn.hyperkit-software.com/personalblog/</a>.
		</p>
