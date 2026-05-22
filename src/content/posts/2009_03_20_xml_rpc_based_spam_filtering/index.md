---
title: "XML-RPC based Spam Filtering."
pubDate: "2009-03-19"
description: "To prevent my blog from being spammed, I recently integrated a spam filtering service. The service is offered by blogspam (dot) net, it's entirely open source a..."
tags: ["blog"]
icon: "/posts/2009_03_20_xml_rpc_based_spam_filtering/http_post.png"
---

<p>
			You might wonder, why I decided to implement my own XML-RPC HTTP client, because there are already packages out there which solve that problem.
			Well of course, first of all I like doing stuff my self (such as implementing my own blog <code>:)</code>).
			But also I was really considering to use an available package for doing that.
			Sadly, Ubuntu only provides a very basic XML-RPC module for PHP5 called <code>php5-xmlrpc</code>.
			The project homepage can be found on <a class="web" href="http://xmlrpc-epi.sourceforge.net/">xmlrpc</a>.
			This is also the package I used in my final implementation for the simlicity of installing it with <code>aptitude</code>.
			A more advanced library is offered by <a class="web" href="http://phpxmlrpc.sourceforge.net/">phpxmlrpc</a> which I didn't bother with trying to install.
			In general cases I would recommend using the second, as the API seems to be quite comprehensive.
		</p>
		<p>
			So now, what's offered by <code>xmlrpc-epi</code>:
			First of all, you can use it to develop your own XML-RPC services.
			This is quite nice, but it's not at all what I wanna do.
			Second, it provides methods for generating XML-RPC fragments which can be passed via HTTP to invoke remote services.
			Here is an example:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_03_20_xml_rpc_based_spam_filtering/php_encode.png"><img src="/posts/2009_03_20_xml_rpc_based_spam_filtering/php_encode.png" style="width: 85%;"/></a>
		</p>
		<p>
			In the previous figure, I show how to generate an XML-RPC request to a method called <code>testComment</code>.
			This method expects the parameters <code>ip</code> for the IP of the user posting the comment, <code>email</code> for the email address provided by the user, <code>name</code> for the name entered by the user and <code>comment</code> for the comment content posted.
			The function call <code>xmlrpc_encode_request</code> will generate the following XML fragment:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_03_20_xml_rpc_based_spam_filtering/xml_rpc_request.png"><img src="/posts/2009_03_20_xml_rpc_based_spam_filtering/xml_rpc_request.png" style="width: 85%;"/></a>
		</p>
		<p>
			The XML format is specified by the XML-RPC standard.
			The recipient can use it to derive which method to call and which parameters to pass.
			For the parameters he can easily find out which type was used on the client side.
		</p>
		<p>
			Now the only thing which is left is to send this fragment via <code>HTTP POST</code> to the service and parse the response.
			As this is not provided by the XML-RPC library I use, I have to implement this part my self.
			For sending HTTP requests I use the method <code>fsockopen</code> which is provided by PHP to open network connections.
			Then I construct the HTTP message which should be sent and write it to the socket.
			Here is the corresponding code fragment:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_03_20_xml_rpc_based_spam_filtering/http_post.png"><img src="/posts/2009_03_20_xml_rpc_based_spam_filtering/http_post.png" style="width: 85%;"/></a>
		</p>
		<p>
			So what's happening is that first the socket is opened to the host <code>test.blogspam.net</code> on port <code>8888</code>
			Then the HTTP request is sent.
			The request specifies the resource <code>/</code> in <code>POST</code> mode and some other header parameters.
			After writing the request this will cause the web service to immediately write the response to the socket and close the stream.
		</p>
		<p>
			Now we have to read and parse the response for getting the answer by the service.
			First let's get the bytes from the stream:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_03_20_xml_rpc_based_spam_filtering/read_socket.png"><img src="/posts/2009_03_20_xml_rpc_based_spam_filtering/read_socket.png"/></a>
		</p>
		<p>
			We read from the stream until the end of the stream is reached, i.e. no byte data is left.
			Then we close the socket and free all resources.
			So here is what the HTTP response looks like:
		</p>
		<p style="text-align: center;">
			<a href="/posts/2009_03_20_xml_rpc_based_spam_filtering/http_response.png"><img src="/posts/2009_03_20_xml_rpc_based_spam_filtering/http_response.png"/></a>
		</p>
		<p>
			The response contains the usual HTTP header and the response body.
			The header gives information about the HTTP status and other header variables such as <code>Content-Length</code> or <code>Content-Type</code>.
			The body contains the value returned by the method <code>testComment</code> (which is the method we envoked in our request) encoded in XML.
			In this example we see that the comment was classified as <em>spam</em> because the IP does not seem to be valid.
			In the case of a non-spam comment the method will return the string <code>OK</code>.
			Now it's just a matter of filtering out this value, e.g. using regular expressions or by actually parsing the response.
		</p>
		<p>
			I hope you enjoyed seeing how easy it is to integrated useful services into your website.
			It would be nice to get some feedback.
			Maybe you found similar solutions or used other hacks.
		</p>
