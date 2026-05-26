---
pubDate: "2024-06-03T20:32:22.381Z"
likes: 35
comments: 2
shares: 0
image: "./image.jpg"
---
Finally, CADdrive features a 𝐩𝐫𝐨𝐩𝐞𝐫 𝐯𝐢𝐬𝐮𝐚𝐥𝐢𝐳𝐚𝐭𝐢𝐨𝐧 of the 𝐂𝐀𝐃 𝐦𝐨𝐝𝐞𝐥 𝐫𝐞𝐯𝐢𝐬𝐢𝐨𝐧 𝐠𝐫𝐚𝐩𝐡 including 𝐛𝐫𝐚𝐧𝐜𝐡𝐢𝐧𝐠 𝐚𝐧𝐝 𝐦𝐞𝐫𝐠𝐢𝐧𝐠 (for building model variants and enabling parallel work on different parts of the model). Below you find two interesting details about this feature...



👨‍🏫 𝘐𝘯𝘵𝘦𝘳𝘦𝘴𝘵𝘪𝘯𝘨 𝘵𝘩𝘦𝘰𝘳𝘦𝘵𝘪𝘤𝘢𝘭 𝘥𝘦𝘵𝘢𝘪𝘭: Revision graphs can be represented as 𝐝𝐢𝐫𝐞𝐜𝐭𝐞𝐝 𝐚𝐜𝐲𝐜𝐥𝐢𝐜 𝐠𝐫𝐚𝐩𝐡𝐬. 𝐓𝐨𝐩𝐨𝐥𝐨𝐠𝐢𝐜𝐚𝐥 𝐬𝐨𝐫𝐭𝐢𝐧𝐠 can be used for layouting such types of graphs. However, you don't have to compute the topological sorting of the graph nodes yourself. The temporal sorting of the CAD model revisions already represents a valid topological sorting! 💡

🧑‍💻 𝘐𝘯𝘵𝘦𝘳𝘦𝘴𝘵𝘪𝘯𝘨 𝘵𝘦𝘤𝘩𝘯𝘪𝘤𝘢𝘭 𝘥𝘦𝘵𝘢𝘪𝘭: We render the revision graph in the 𝐖𝐞𝐛 𝐁𝐫𝐨𝐰𝐬𝐞𝐫 using 𝐒𝐜𝐚𝐥𝐚𝐛𝐥𝐞 𝐕𝐞𝐜𝐭𝐨𝐫 𝐆𝐫𝐚𝐩𝐡𝐢𝐜𝐬 (𝐒𝐕𝐆) within functional JS Components. The trickiest part was to make the color-coding work due to a bug in Google Chrome's SVG render engine. This bug prevents perfectly vertical lines with linear gradients from being rendered. 🤯



📢 Check out CADdrive yourself at CADdrive.com and CADdrive.org!

📑 Currently, CADdrive supports CAD models in #LDraw and #GLTF formats. You can use, e.g., LeoCAD for creating and editing LDraw models. And you can use 𝐂𝐀𝐃 𝐀𝐬𝐬𝐢𝐬𝐭𝐚𝐧𝐭 from Open Cascade, part of Capgeminifor converting CAD models in #STEP format to GLTF format. We work on direct support of the STEP format!



🏢 CADdrive is being developed at the FH OÖ Campus Wels | School of Engineering in Wels, Upper Austria.

🤓 CADdrive includes contributions from Christian Zehetner, Dominik Frühwirth, Jürgen Humenberger, and Georg Hackenberg.



#productdesign #fhooe #fhwels
#cad #pdm #plm #mbse #vcs #scm #git

the LEGO Group (Ricardo Abrantes)
LEGO Education (Arthur Sacek, Andrew Sliwinski)
The Design Society
