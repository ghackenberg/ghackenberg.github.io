---
title: "Personal Source Code Portal"
pubDate: "2011-04-28"
description: "Since I have been asked for the code behind some articles, I decided to put online a separate website for public tracking and distributing the software projects..."
tags: ["hyperkit-software"]
icon: "./dashboard.png"
---
The idea behind the **personal source code portal** is probably best explained along a few screenshots of the running system.
When entering the protal the user is presented with a so-called *dashboard*.
The goal of the dashboard is to provide the user with an overview of the available projects and their respective status.
Therefore the logo, the title and a short description of each project is displayed as well as the current version number from the file versioning system.

![Dashboard illustration from Personal Source Code Portal](./dashboard.png)

From the dashboard the user can select the project that he/she wants to know more about.
The project page is intended to provide access to all project-relevant resources such as screenshots, tutorials, activity feed, etc.
Moreover this should be the place where users can start getting involved e.g. by asking questions, helping others with solutions, or contributing to the source code and other project files.

![Project illustration from Personal Source Code Portal](./project.png)

Finally, the source code of the project can be accessed via a public read-only Subversion (SVN) repository.
The repository allows every user to easily download the software package through a SVN client such as TortoiseSVN.
Also you can stay up-to-date with bug fixes, new features, and latest versions in general.

![Webdav illustration from Personal Source Code Portal](./webdav.png)

I plan to extend the features of the source code portal on demand.
Certainly, one of the next steps will be to include feed support for distributing news into the network.
Also a discussion module should be available, probably similar to the one on my blog (which is easy to integrate).
