---
title: "Lightweight Blog Implementation."
pubDate: "2009-02-16"
description: "In this article I describe how this website is created. You get a good insight into the techniques and technologies used. And maybe you get good ideas for your ..."
tags: ["blog"]
icon: "/posts/2009_02_17_lightweight_blog_implementation/article.png"
---

<p>
			<a href="/posts/2009_02_17_lightweight_blog_implementation/svn.png"><img src="/posts/2009_02_17_lightweight_blog_implementation/svn.png" style="width: 40%; margin-left: 1em; margin-bottom: 1em;" align="right"/></a>
			The general infrastructure of the online publication system is depicted in the figure to the right.
			Most importantly, I have a <em>Subversion</em> repository installed on my <em>Apache</em> web server which is accessible via <em>WebDAV</em>.
			This respository contains the entire website from the front page to all articles including the comments.
		</p>
		<p>
			On my local workstation I have a working copy of the repository checked out and connected to a local <em>Apache</em> installation.
			Here, I can make changes to the content as well as server-side components such as <em>PHP</em> scripts and directly see the changes.
			When I am finished updating the website I can commit the changes to the repository which causes the files to be uploaded to the webserver.
		</p>
		<p>
			On the webserver, the <em>Apache</em> implementation of <em>WebDAV</em> recognizes the <em>Subversion</em> commit and updates the respository database.
			For the repository, additionally a <em>post-commit</em> hook is configured, which automatically updates a working copy which represents the actual online version.
			Now people browsing my website can see the changes I made locally on my development machine.
		</p>
		<p style="clear: both;">
			Having said enough about the infrastructure of the publication system I now explain the server-side components.
			First, let's have a look at the index page:
			The index page provides a list of all articles posted to this Blog which is devided into media categories.
			The four different media categories currently supported are <em>article</em>, <em>multimedia</em>, <em>link</em> and <em>announcement</em>.
			The posts for each category are stored within a separate folder.
			To generate the media lists, these folders are traveresed and the contents are extracted.
			Here is a code fragment from the index page:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_02_17_lightweight_blog_implementation/index.png"><img src="/posts/2009_02_17_lightweight_blog_implementation/index.png" style="width: 75%;"/></a>
		</p>
		<p>
			The function <code>listMedia</code> takes the path of the folder and the style to use as a parameter.
			In return, it generates <code>li</code> HTML list items containing a reference to the article and some meta information.
			You can also see the link to the <em>RSS</em> feed.
			The feed resuses the function <code>listMedia</code> with a different style as shown in the next example:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_02_17_lightweight_blog_implementation/rss.png"><img src="/posts/2009_02_17_lightweight_blog_implementation/rss.png" style="width: 75%;"/></a>
		</p>
		<p>
			Here, the function generates <code>item</code> elements for the <em>RSS</em> feed.
			The feeds for the other media types are implemented in the same way.
			As we have seen, the media listing functionality can be shared by several parts of the website.
			This makes it possible, to centralize the extraction of article information.
			Different styles are achieved by specifying the name of a callback function (e.g. <code>rssFormat</code> or <code>htmlFormat</code>).
		</p>
		<p>
			Having seen how articles are listed, we now have a look at the articles themselves.
			Articles basically are just simple HTML pages stored in a category folder.
			The following code listing shows an example taken from this website:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_02_17_lightweight_blog_implementation/article.png"><img src="/posts/2009_02_17_lightweight_blog_implementation/article.png" style="width: 75%;"/></a>
		</p>
		<p>
			Each article has to define a <em>title</em>, a <em>date</em> and a <em>tagline</em>.
			These information items are considered as meta-data and displayed in media listings such as the front page and the <em>RSS</em> feeds.
			The function <code>listMedia</code> which has been introduced before basically extracts these attributes using <em>regular expressions</em> and passes it to the formatting functions.
			The rest of the article is basic HTML and can contains simply anything you want from embedded <em>Youtube</em> videos to <em>JavaScript</em> applications.
		</p>
		<p>
			Additionally, articles provide the means for posting comments by any user on the web.
			Therefore, the HTML structures for representing the comments as well as a post form are included at the bottom of the page.
			Here is an example from the previously discussed article example:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_02_17_lightweight_blog_implementation/comments.png"><img src="/posts/2009_02_17_lightweight_blog_implementation/comments.png" style="width: 75%;"/></a>
		</p>
		<p>
			The comment part of articles is contained within a dedicated <code>div</code> fragment.
			The fragment basically contains an ordered list (represented as an <code>ol</code> element) for storing the individual posts by different users.
			Each post stores the <em>date</em>, the URL of the <em>homepage</em>, the <em>author</em> name and its <em>content</em>.
			Additionally, an <em>email</em> address can be attached which is stored within <em>PHP</em> tags.
			This is due to keeping the email private, i.e. it will never be returned to the web browser, but can be extracted within server-side components using for example <em>regular expressions</em>.
		</p>
		<p>
			Finally, let's have a look what happens when a user posts a comment.
			Basically, a script is executed checking the integrity of the data and initiating the permanent storage.
			Additionally, an email is sent to those users which have specified an email address within their post.
			The following code fragment shows what happens after sending this email:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_02_17_lightweight_blog_implementation/commenting.png"><img src="/posts/2009_02_17_lightweight_blog_implementation/commenting.png" style="width: 75%;"/></a>
		</p>
		<p>
			In the first lines, a new HTML fragment is created from the comment which conforms to the structure shown before.
			Then this fragment is inserted into the article using the function <code>preg_replace</code> (this function is <em>regular expression</em> based).
			After updating the content, the results are written back to the article file and the changes are commited to the repository.
			This makes it possible to retrieve all updates also on the development system, i.e. my local machine.
			At last, the user is redirected to the same page againg targeting the comment section (using the <code>#comment</code> suffix).
			When reloading the page, the user will already get the new version with the updated comment section.
		</p>
		<p>
			Well, that's how my Blog works.
			I hope you liked the introduction into <strong>lightweight blogging</strong> ;).
			It would be great to get some comments about it.
		</p>
