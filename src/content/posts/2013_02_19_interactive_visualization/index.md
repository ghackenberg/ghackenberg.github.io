---
title: "Model Visualization for Windows and Android"
pubDate: "2013-02-18"
description: "As part of our virtual smart grid testbed lab we have been working on an interactive visualization for our models including their structure and behavior. Here a..."
tags: ["data-visualization", "user-interface"]
icon: "/posts/2013_02_19_interactive_visualization/screenshot_android.png"
---

Technically, the visualization is developed using standard HTML 5 web technology.
The solution has been optimized to run with Mozilla Firefox and Google Chrome.
Here is a screenshot of the software running on Windows 8.

![](/posts/2013_02_19_interactive_visualization/screenshot_windows.png)

Besides performance issues a big advantage of web technologies is their cross-platform compatibility.
Consequently, it was an easy step to run the the visualization for example on an Android device.

![](/posts/2013_02_19_interactive_visualization/screenshot_android.png)

Finally, we have built a simple App experience from the HTML application.
The App basically adds a single Android Activity class including a WebView component, which is initialized to local assets.

![](/posts/2013_02_19_interactive_visualization/screenshot_android_app.png)

In the future we plan to extend the application with a number of visualization components.
The goal is to enable people understanding the complex behavior of smart energy systems.
