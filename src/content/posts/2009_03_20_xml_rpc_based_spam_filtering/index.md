---
title: "XML-RPC based Spam Filtering."
pubDate: "2009-03-19"
description: "To prevent my blog from being spammed, I recently integrated a spam filtering service. The service is offered by blogspam (dot) net, it's entirely open source a..."
tags: ["blog"]
icon: "/posts/2009_03_20_xml_rpc_based_spam_filtering/http_post.png"
---

You might wonder, why I decided to implement my own XML-RPC HTTP client, because there are already packages out there which solve that problem.
Well of course, first of all I like doing stuff my self (such as implementing my own blog `:)`).
But also I was really considering to use an available package for doing that.
Sadly, Ubuntu only provides a very basic XML-RPC module for PHP5 called `php5-xmlrpc`.
The project homepage can be found on [xmlrpc](http://xmlrpc-epi.sourceforge.net/).
This is also the package I used in my final implementation for the simlicity of installing it with `aptitude`.
A more advanced library is offered by [phpxmlrpc](http://phpxmlrpc.sourceforge.net/) which I didn't bother with trying to install.
In general cases I would recommend using the second, as the API seems to be quite comprehensive.

So now, what's offered by `xmlrpc-epi`:
First of all, you can use it to develop your own XML-RPC services.
This is quite nice, but it's not at all what I wanna do.
Second, it provides methods for generating XML-RPC fragments which can be passed via HTTP to invoke remote services.
Here is an example:

[![](/posts/2009_03_20_xml_rpc_based_spam_filtering/php_encode.png)](/posts/2009_03_20_xml_rpc_based_spam_filtering/php_encode.png)

In the previous figure, I show how to generate an XML-RPC request to a method called `testComment`.
This method expects the parameters `ip` for the IP of the user posting the comment, `email` for the email address provided by the user, `name` for the name entered by the user and `comment` for the comment content posted.
The function call `xmlrpc_encode_request` will generate the following XML fragment:

[![](/posts/2009_03_20_xml_rpc_based_spam_filtering/xml_rpc_request.png)](/posts/2009_03_20_xml_rpc_based_spam_filtering/xml_rpc_request.png)

The XML format is specified by the XML-RPC standard.
The recipient can use it to derive which method to call and which parameters to pass.
For the parameters he can easily find out which type was used on the client side.

Now the only thing which is left is to send this fragment via `HTTP POST` to the service and parse the response.
As this is not provided by the XML-RPC library I use, I have to implement this part my self.
For sending HTTP requests I use the method `fsockopen` which is provided by PHP to open network connections.
Then I construct the HTTP message which should be sent and write it to the socket.
Here is the corresponding code fragment:

[![](/posts/2009_03_20_xml_rpc_based_spam_filtering/http_post.png)](/posts/2009_03_20_xml_rpc_based_spam_filtering/http_post.png)

So what's happening is that first the socket is opened to the host `test.blogspam.net` on port `8888`
Then the HTTP request is sent.
The request specifies the resource `/` in `POST` mode and some other header parameters.
After writing the request this will cause the web service to immediately write the response to the socket and close the stream.

Now we have to read and parse the response for getting the answer by the service.
First let's get the bytes from the stream:

[![](/posts/2009_03_20_xml_rpc_based_spam_filtering/read_socket.png)](/posts/2009_03_20_xml_rpc_based_spam_filtering/read_socket.png)

We read from the stream until the end of the stream is reached, i.e. no byte data is left.
Then we close the socket and free all resources.
So here is what the HTTP response looks like:

[![](/posts/2009_03_20_xml_rpc_based_spam_filtering/http_response.png)](/posts/2009_03_20_xml_rpc_based_spam_filtering/http_response.png)

The response contains the usual HTTP header and the response body.
The header gives information about the HTTP status and other header variables such as `Content-Length` or `Content-Type`.
The body contains the value returned by the method `testComment` (which is the method we envoked in our request) encoded in XML.
In this example we see that the comment was classified as *spam* because the IP does not seem to be valid.
In the case of a non-spam comment the method will return the string `OK`.
Now it's just a matter of filtering out this value, e.g. using regular expressions or by actually parsing the response.

I hope you enjoyed seeing how easy it is to integrated useful services into your website.
It would be nice to get some feedback.
Maybe you found similar solutions or used other hacks.
