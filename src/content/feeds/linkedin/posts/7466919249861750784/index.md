---
pubDate: "2026-05-31T18:31:17.795Z"
likes: 20
comments: 2
shares: 0
image: "./image.jpg"
---
My daughter recently asked me if we could make a movie together. I told her that realistic film production is too expensive and complex for us, but we could try making a comic-style animation instead. 

So, I started playing around with programmatic character animations in the browser. 

Since I didn't want to animate keyframes manually in a heavy video editor, I asked my coding agent, Antigravity, to help me build a procedural character rig. We ended up building a fully vector-based character walking, running, and talking down a street using React, HTML, and SVGs:

1️⃣ 𝐃𝐲𝐧𝐚𝐦𝐢𝐜 𝐈𝐊 𝐒𝐨𝐥𝐯𝐞𝐫: The character's limbs (knees and elbows) bend naturally on the fly using standard trigonometry equations in JavaScript, rather than pre-rendered assets.
2️⃣ 𝐑𝐮𝐧𝐧𝐢𝐧𝐠 𝐊𝐢𝐧𝐞𝐦𝐚𝐭𝐢𝐜𝐬: The system automatically tilts the torso forward, extends the stride, and lifts the knees. We even implemented a dual flight phase where both feet are off the ground, with hip bobbing that naturally cushions the landing.
3️⃣ 𝐈𝐧𝐭𝐞𝐫𝐚𝐜𝐭𝐢𝐯𝐞 𝐋𝐢𝐠𝐡𝐭𝐢𝐧𝐠 & 𝐏𝐚𝐫𝐚𝐥𝐥𝐚𝐱: Street lamps cast dynamic cones of light that blend overlays and adjust ground shadows as they scroll past. The houses and background elements scroll at different speeds to create depth.
4️⃣ 𝐒𝐩𝐞𝐞𝐜𝐡 𝐁𝐮𝐛𝐛𝐥𝐞 𝐓𝐫𝐚𝐜𝐤𝐢𝐧𝐠: The tail of the speech bubble dynamically tracks the mouth coordinate in real time as the character breathing-bobs and gestures.

This was built entirely inside Remotion, which lets us render the whole canvas into a video programmatically. It's a nice showcase of what modern web technologies and AI coding agents can do when you combine them.

I plan to open-source the code soon.

#creativecoding #remotion #svg #reactjs #generativeai #codingagents #animation #typescript
