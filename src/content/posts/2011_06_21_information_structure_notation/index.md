---
title: "Describing the Structure of Information"
pubDate: "2011-06-20"
description: "In a previous article I explained the basic Information Visualization Problem caused by the vast space of options for visual design. In this article I concentra..."
tags: ["drawing"]
icon: "/posts/2011_06_21_information_structure_notation/custom.jpg"
---

<p>
			Consider the case of a blog, where articles are organized by date.
			Further, the articles my contain any number of images and videos.
			In particular, this information structure serves as the foundation of this website.
			Now, in UML this structure would be visualized as follows.
			<code>Blog</code>, <code>Article</code>, <code>Image</code> and <code>Video</code> are the basic information blocks each depicted by a box.
			The lines between the boxes define the associations of the information, e.g. an article my contain several images respectively videos, where a blog may contain several articles.
			The <code>*</code> (star) sign indicates the number of admissable instances of the particular information block, e.g. a blog may contain any number of articles and an artcile may contain any number of images/videos.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2011_06_21_information_structure_notation/uml.jpg"><img src="/posts/2011_06_21_information_structure_notation/uml.jpg" style="width: 100%;"/></a>
		</p>
		<p>
			Now compare the above visualization to the following variation, where more figurative illustrations of the information blocks are provided.
			Again, the same notation is used to describe the associations between the blocks.
			However, the blocks themselves are depicted by content-specific icons rather than abstract content-unspecific box shapes.
			In the case of a blog this extended visualization might not add much information because for many readers the terms <em>blog</em>, <em>article</em>, <em>image</em>, and <em>video</em> have already associated a clear mental picture.
			In other cases these mental pictures might not be as obvious (e.g. the information blocks <code>Tag</code>, <code>Category</code>, or <code>Tutorial</code>), and a more illustrative approach can actually contribute to the understanding of the structure.
		</p>
		<p style="text-align: center;">
			<a href="/posts/2011_06_21_information_structure_notation/custom.jpg"><img src="/posts/2011_06_21_information_structure_notation/custom.jpg" style="width: 100%;"/></a>
		</p>
		<p>
			My concluding argument is that I believe more figurative visualizations of information are in many cases superior to content-unspecific visual notations.
			However, in this article this only applies to information blocks and not to associations between these blocks.
			Questions that arise from these considerations are (1) the value of figurative illustration, (2) the extend of figurative illustration, and (3) the tool support for effective creation.
		</p>
