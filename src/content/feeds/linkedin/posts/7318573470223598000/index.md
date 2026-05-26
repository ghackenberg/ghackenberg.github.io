---
pubDate: "2025-04-17T09:58:07.785Z"
likes: 45
comments: 4
shares: 0
image: "./image.jpg"
---
PPS: Here are the figures (in extended edition) for our 𝐬𝐩𝐢𝐧𝐞 𝐥𝐚𝐲𝐨𝐮𝐭 𝐦𝐨𝐝𝐞𝐥𝐢𝐧𝐠 𝐚𝐧𝐝 𝐬𝐢𝐦𝐮𝐥𝐚𝐭𝐢𝐨𝐧 𝐚𝐩𝐩𝐫𝐨𝐚𝐜𝐡 from the CIRP Conference on Manufacturing Systems at University of Twente in the Netherlands. As explained in the slides, the configuration model comprises:

- a 𝐝𝐨𝐦𝐚𝐢𝐧 𝐦𝐨𝐝𝐞𝐥 (product, machine, tool, and operation types),
- a 𝐬𝐨𝐥𝐮𝐭𝐢𝐨𝐧 𝐦𝐨𝐝𝐞𝐥 (layouts, corridors, and machines), and
- an 𝐞𝐯𝐚𝐥𝐮𝐚𝐭𝐢𝐨𝐧 𝐦𝐨𝐝𝐞𝐥 (scenarios and orders).

One interesting aspect of the domain model is that 𝐟𝐥𝐞𝐱𝐢𝐛𝐥𝐞 𝐩𝐫𝐨𝐝𝐮𝐜𝐭𝐢𝐨𝐧 𝐩𝐫𝐨𝐜𝐞𝐬𝐬𝐞𝐬 can be described quite intuitively as 𝘥𝘪𝘳𝘦𝘤𝘵𝘦𝘥 𝘨𝘳𝘢𝘱𝘩𝘴 𝘰𝘧 𝘮𝘢𝘯𝘶𝘧𝘢𝘤𝘵𝘶𝘳𝘪𝘯𝘨 𝘢𝘯𝘥 𝘢𝘴𝘴𝘦𝘮𝘣𝘭𝘺 𝘰𝘱𝘦𝘳𝘢𝘵𝘪𝘰𝘯𝘴 running on machine types and using certain tool types. In addition to the concepts of the configuration model, the simulation model comprises:

- 𝐬𝐭𝐨𝐫𝐚𝐠𝐞𝐬 for buffering WIP at various locations in the system,
- 𝐫𝐨𝐛𝐨𝐭𝐬 for transporting WIP between buffers and machines, and
- 𝐣𝐨𝐛𝐬 for representing the WIP itself that flows through the system.

Note that our approach implicitly assumes a certain number of storages and robots to be present in the system. The number of storages and robots essentially depends on the number of side corridors defines by the system designer. Additionally, the jobs are derived directly from the orders and their quantities.

Finally, I would like to mention that the diagrams were made with Mermaid, a JavaScript library and command line interface (CLI) for diagram-as-code. Mermaid allows you to describe your diagrams using a special syntax for class diagrams, flow charts, sequence diagrams, and more. The image compiler can be integrated easily in Microsoft Visual Studio Code using the "run on save" extension. I strongly recommend this framework 👍
