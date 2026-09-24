---
title: "Interactive Presentations: Die Slide-as-Code Engine"
subtitle: "Motivation, Content-Strategie und Architektur web-nativer Keynotes mit Neural-Voiceover"
pubDate: "2026-09-23"
event: "Tech Briefing & Architecture Showcase"
location: "Campus Wels, FH Oberösterreich"
audience: "Software-Architekten, Web-Entwickler, Dozierende und Technologie-Entscheider"
lang: "de"
description: "Strategischer Leitfaden und Architektur-Briefing zur Slide-as-Code Presentation Engine: Motivation für den neuen Webseitenbereich, Einbettung in das wissenschaftliche Content-Ökosystem, evaluierte Alternativen und technische Realisierung mit Astro SSG und Edge TTS."
tags: ["astro", "agentic-ai", "software-architecture", "web-development", "typescript", "content-engineering", "ux-design", "open-source"]
previewImage:
  src: "./preview.jpg"
  title: "Dr. Georg Hackenberg präsentiert die Slide-as-Code Presentation Engine"
  description: "Architektur-Präsentation der interaktiven Slide-as-Code Engine mit Neural-Voiceover vor der beamergestützten Leinwand am FH OÖ Campus Wels"
---

## Über diesen Vortrag

In diesem 10-Folien-Architektur-Briefing stellt Dr. Georg Hackenberg den neuen Webseiten-Bereich [Interactive Presentations](/presentations/) vor. Der Vortrag beleuchtet die Kernmotivation hinter der Entwicklung einer maßgeschneiderten, web-nativen Präsentationsplattform, ordnet das Format in das übergeordnete Content-Ökosystem der Website ein und dokumentiert die technische Umsetzung mittels Astro Static Site Generation, deklarativen MDX-Archetypen und subsekundengenauer Edge-TTS-Sprachsynchronisation.

### Zentrale Themenschwerpunkte:
1. **Das Dilemma des Status Quo:** Warum statische PDF-Downloads und fremde iFrame-Embeds die Barrierefreiheit, SEO und Nutzererfahrung digitaler Fachvorträge untergraben.
2. **Das erweiterte Content-Ökosystem:** Wie interaktive Keynotes die Lücke zwischen tiefen Blog-Analysen (`posts`), wissenschaftlichen Papers (`publications`), Vorlesungen (`courses`) und interaktiven Demos (`visualizations`) schließen.
3. **Übergeordnete Content-Strategie:** Holistisches Wissens-Repurposing von der ersten Forschungszeile bis zum maschinenlesbaren Schema.org-Wissensgraphen für generative KI-Suchmaschinen (GEO & AIO).
4. **Evaluierte Technologie-Optionen:** Detaillierte Analyse, warum Cloud-Embeds (Pitch, Google Slides) und Entwickler-Tools (Reveal.js, Slidev, Marp) den Anforderungen einer nahtlosen SSG-Plattform nicht genügten.
5. **Die Slide-as-Code Engine:** 1920x1080 Vektorbühne (`SlideCanvas`), 6 standardisierte Folien-Archetypen, 60fps Spotlight-Tracking via `AudioSyncController.ts` und automatisierte CI-Qualitätsgates.
