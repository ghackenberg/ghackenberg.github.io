---
title: "Zeilenexakte Text-Geometrie & 2D-SDF-Gitter mit TreeWalker im Hero-Layout"
pubDate: 2026-10-14
description: "Wie wir mit TreeWalker, Range.getClientRects() und 2D Signed Distance Fields (Quilez smin) ein kollisionsfreies Hero-Layout mit 60 FPS Canvas-Batching bauten."
lang: de
tags:
  - web-development
  - typescript
  - javascript
  - computer-graphics
  - ux-design
  - user-interface
  - performance
  - optimization
  - astro
  - software-architecture
icon:
  src: ./hero.jpg
  title: "Dr. Georg Hackenberg entwickelt die TreeWalker- und 2D-SDF-Hero-Engine im Almtal Home Office"
  description: "Dr. Georg Hackenberg analysiert am Ultrawide-Monitor im Almtal Home Office die zeilenexakte TreeWalker-Textkontur und das 2D-Signed-Distance-Field-Punktraster"
references:
  - id: whatwg-2024-dom-treewalker
    type: online
    author: "WHATWG"
    title: "DOM Standard — Interface TreeWalker and NodeIterator"
    url: "https://dom.spec.whatwg.org/#interface-treewalker"
    year: 2024
    siteName: "WHATWG Living Standard"
  - id: w3c-2016-cssom-view
    type: online
    author: "W3C CSS Working Group"
    title: "CSSOM View Module — Extensions to the Range Interface (getClientRects)"
    url: "https://www.w3.org/TR/cssom-view-1/#extensions-to-the-range-interface"
    year: 2016
    siteName: "W3C Working Draft"
  - id: w3c-2014-css-font-loading
    type: online
    author: "W3C CSS Working Group"
    title: "CSS Font Loading Module Level 3 — The ready Attribute"
    url: "https://www.w3.org/TR/css-font-loading-3/#font-face-set-ready"
    year: 2014
    siteName: "W3C Working Draft"
  - id: knuth-1981-breaking-paragraphs
    type: article
    author: "Knuth, Donald E. and Plass, Michael F."
    title: "Breaking Paragraphs into Lines"
    journal: "Software: Practice and Experience"
    year: 1981
    volume: "11"
    number: "11"
    pages: "1119--1184"
    url: "https://doi.org/10.1002/spe.4380111102"
    doi: "10.1002/spe.4380111102"
  - id: quilez-2013-smin
    type: online
    author: "Quilez, Inigo"
    title: "Smooth Minimum (smin) for Distance Fields"
    url: "https://iquilezles.org/articles/smin/"
    year: 2013
    siteName: "Inigo Quilez Articles"
  - id: quilez-2018-distfunctions2d
    type: online
    author: "Quilez, Inigo"
    title: "2D Distance Functions (Signed Distance Fields)"
    url: "https://iquilezles.org/articles/distfunctions2d/"
    year: 2018
    siteName: "Inigo Quilez Articles"
  - id: green-2007-alpha-tested-magnification
    type: inproceedings
    author: "Green, Chris"
    title: "Improved Alpha-Tested Magnification for Vector Textures and Special Effects"
    booktitle: "ACM SIGGRAPH 2007 Courses"
    year: 2007
    pages: "9--18"
    url: "https://doi.org/10.1145/1281500.1281665"
    doi: "10.1145/1281500.1281665"
  - id: badros-2001-cassowary
    type: article
    author: "Badros, Gregory J. and Borning, Alan and Stuckey, Peter J."
    title: "The Cassowary Linear Arithmetic Constraint Solving Algorithm"
    journal: "ACM Transactions on Computer-Human Interaction"
    year: 2001
    volume: "8"
    number: "4"
    pages: "267--306"
    url: "https://doi.org/10.1145/504704.504705"
    doi: "10.1145/504704.504705"
---

Die Kombination aus zeilenexakter DOM-Textvermessung mittels `document.createTreeWalker` und `Range.getClientRects()` sowie kontinuierlichen zweidimensionalen Signed Distance Fields (2D SDF) löst ein klassisches Dilemma moderner Web-Oberflächen: Sie ersetzt starre, rechteckige CSS-Block-Bounding-Boxes durch die reale, treppenförmige Zeilenkontur des umbrochenen Textes. Auf dieser Basis platziert ein deterministischer 2D-Optimierer im Hero-Bereich unserer Startseite sowohl das interaktive WebGL-Porträt als auch ein physikbasiertes Hintergrund-Punktraster millimetergenau in die frei gewordenen Freiräume – ohne Überlappungen, ohne Layout-Shift (CLS = 0) und mit maximal zehn gebündelten Canvas-2D-Draw-Calls pro Frame.

Die folgende Architektur-Übersicht zeigt den qualitativen und quantitativen Unterschied zwischen klassischer CSS-Block-Geometrie, CSS Shapes und unserer sub-elementaren `TreeWalker` + 2D-SDF-Pipeline:

| Dimension | Klassisches CSS Grid / Flexbox (`getBoundingClientRect`) | CSS Shapes (`shape-outside`) | Sub-Element `TreeWalker` + 2D-SDF-Pipeline (`hackenberg.tech`) |
| :--- | :--- | :--- | :--- |
| **Geometrische Auflösung** | Grobe Element-Box (`max-w-2xl`); ignoriert vorzeitige Zeilenumbrüche und verschenkt rechtsseitigen Freiraum. | Fließtext umfließt ein statisches Float-Bild; keine Rückkopplung der Textkontur an Canvas-Hintergründe. | Zeilenexakte `Range.getClientRects()`-Vermessung jedes Textknotens; präzises 1D-Intervall-Merging (`bands[]`). |
| **Dynamische Objekt-Platzierung** | Starre Breakpoints (`md:`, `lg:`); führt auf Zwischenbreiten zu Sprüngen oder konservativ geschrumpften Bildern. | Nur für Inline-Floats nutzbar; kein globaler 2D-Kollisions-Solver für unabhängige UI-Layer. | Exakter 2D-Solver prüft konkurrierende Kandidaten (*Rechts-Mittig* vs. *Oben neben H1*) mit `+4px` Hysterese. |
| **Hintergrund-Partikel & Konturschnitt** | Rechteckiger Ausschnitt oder Übermalen von Text (schlechter Kontrast und visuelle Unruhe). | Keine Schnittstelle zu HTML5 Canvas oder WebGL-Partikelsystemen. | Kontinuierliches 2D-SDF (`sdRoundRect`) mit polynomieller $C^1$-Verschmelzung (`smin`) und 32px Smoothstep-Fade. |
| **Rendering-Effizienz (Canvas 2D)** | Einzelnes `ctx.fill()` pro Partikel erzeugt hunderte State-Changes pro Frame bei individueller Opazität. | Nicht anwendbar (rein deklaratives Text-Wrapping im Browser-Layout). | **10-Bucket Opacity Quantisierung** (`alphaBin = 0..9`) reduziert hunderte Punkte auf **maximal 10 Draw-Calls/Frame**. |
| **Webfont- & First-Paint-Stabilität** | Anfällig für Flash of Unstyled Text (FOUT) und nachträgliche Geometrie-Sprünge beim Font-Swap. | Reflow bei Webfont-Ladevorgang verschiebt Zeilenumbrüche sichtbar. | Synchronisiertes Zwei-Barrieren-Gate (`document.fonts.ready` $\land$ `portrait:ready`) garantiert **CLS = 0**. |

> [!TIP]
> **Live-Implementierung im Quellcode:**  
> Der vollständige Geometrie- und Platzierungs-Solver ist in [`src/pages/index.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/index.astro) (Zeilen 1264–1617) implementiert; das kontinuierliche 2D-SDF-Gitter und die Feder-Dämpfer-Physik befinden sich in [`src/components/ReactiveDotGrid.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/ReactiveDotGrid.astro).

## Warum versagen klassische CSS-Block-Boxen bei asymmetrischen Hero-Layouts?

Klassische CSS-Block-Boxen versagen bei asymmetrischen Hero-Layouts, weil das Browser-Box-Modell jedes Block-Element (`<h1>`, `<p>`, `<div>`) als achsenparalleles Rechteck über seine volle Containerbreite (`max-width`) behandelt, selbst wenn einzelne Textzeilen durch den Zeilenumbruch deutlich früher enden. Dadurch entsteht am rechten Rand von Überschriften und Absätzen ein unsichtbarer „toter Raum" von oft 180 bis 340 Pixeln Breite, der für benachbarte Grafiken oder interaktive Hintergrund-Gitter gesperrt bleibt.

Seit der Formalisierung des optimalen Zeilenumbruchs durch [@knuth-1981-breaking-paragraphs] und moderner linearer Constraint-Solver für Benutzeroberflächen wie Cassowary [@badros-2001-cassowary] gilt im UI-Engineering ein strukturelles Spannungsfeld: Typografie erzeugt im Flattersatz (*Ragged Right*) eine organische, stufenförmige Außenkontur, während Layout-Container in HTML und CSS streng rechteckige Boxen aufspannen.

Im Hero-Bereich unserer Startseite treffen fünf semantisch unterschiedliche Inhaltsschichten aufeinander:

1. **Hauptüberschrift (`#hero-heading`):** Zweizeiliges `<h1>` mit großem Schriftgrad (`text-4xl md:text-6xl`, Font *Outfit Extrabold*), dessen erste Zeile (`"Hi, I am"`) oder zweite Zeile (`"Dr. Georg Hackenberg"`) je nach Viewport-Breite unterschiedlich weit nach rechts ragt.
2. **Untertitel (`#hero-subtitle`):** Mehrzeilige Rollenbeschreibung mit Bullet-Separatoren.
3. **Biografie-Absatz (`#hero-bio`):** Fließtext mit eingebetteten `<strong>`-Hervorhebungen und Inline-Emojis.
4. **Entity-Trust-Pills (`#hero-trust-pills`):** Flex-Wrap-Zeilen aus sechs abgerundeten Glassmorphism-Badges (*FH Upper Austria*, *TU Munich*, *RWTH Aachen*, *Uni Mannheim*, *CADdrive*, *Mentawise*).
5. **Aktionsleiste (`#hero-actions-row`):** Primärer Call-to-Action-Button (`#hero-contact-btn`) neben vier quadratischen Social-Media-Schaltflächen (`#hero-social-group`).

Verwendet man zur Kollisionsvermeidung die Standardmethode `Element.getBoundingClientRect()` auf den Block-Elementen `<h1>` und `<p>`, meldet der Browser für jeden Absatz konstant die volle CSS-Maximalbreite (`max-w-2xl`, also $672\text{ px}$). Auf einem typischen Tablet- oder kompakten Laptop-Viewport ($768\text{ px}$ bis $1150\text{ px}$) bleibt rechts neben dieser $672\text{ px}$ breiten Block-Box kaum Platz – obwohl in Wahrheit neben der kürzeren H1-Überschrift oder neben den umbrochenen Pill-Reihen hunderte Quadratpixel völlig frei wären.

![Vergleich zwischen starrer CSS Block-Bounding-Box und zeilenexakter TreeWalker-Kontur](./block_box_vs_treewalker_contour.svg "Block-Box vs. Sub-Element TreeWalker-Zeilenkontur")

Um diesen verschenkten Raum zurückzugewinnen, müssen wir die Ebene der CSS-Block-Container verlassen und die tatsächliche optische Belegung jeder einzelnen Textzeile und jedes Inline-Badges vermessen.

## Wie extrahiert man zeilenexakte Text-Konturen mit TreeWalker und Range.getClientRects()?

Die zeilenexakte Extraktion einer Text-Kontur gelingt durch die Kombination des DOM-Iterators `document.createTreeWalker(el, NodeFilter.SHOW_TEXT)` mit der CSSOM-View-Methode `Range.getClientRects()`. Während der `TreeWalker` sämtliche Textknoten auch über verschachtelte Inline-Elemente (`<span>`, `<strong>`) hinweg traversiert, liefert ein darüber gelegtes `Range`-Objekt für jeden Zeilenumbruch ein separates, pixelgenaues Client-Rechteck der tatsächlich gerenderten Glyphen.

Würde man lediglich `el.getClientRects()` auf dem Eltern-Element `<p>` aufrufen, erhielte man weiterhin nur eine einzige große Block-Box. Erst wenn man auf die Blattknoten des DOM-Baums (`Text`-Nodes) hinabsteigt und deren Inhalt über `document.createRange()` markiert, schlüsselt die Layout-Engine des Browsers gemäß W3C CSSOM View Specification [@w3c-2016-cssom-view] jeden mehrzeiligen Textknoten in ein `DOMRectList`-Array seiner einzelnen Bildschirmzeilen auf.

### Schritt 1: Tiefentraversierung aller Textknoten via `TreeWalker`

Da unsere Überschrift Farbverlaufs-Spans (`<span class="heading-gradient-brand">`) und der Biografie-Text zahlreiche `<strong>`-Elemente enthält, reicht eine flache Iteration über `childNodes` nicht aus. Der im WHATWG DOM Standard [@whatwg-2024-dom-treewalker] spezifizierte `TreeWalker` mit der Bitmaske `NodeFilter.SHOW_TEXT` besucht jeden Textknoten in Dokumentreihenfolge ohne Rekursions-Overhead:

```javascript
const gridRect = heroGrid.getBoundingClientRect();
const rawRects = [];

function collectLineRects(el) {
  if (!el) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent || !node.textContent.trim()) continue;
    const r = document.createRange();
    r.selectNodeContents(node);
    const clientRects = r.getClientRects();
    for (let i = 0; i < clientRects.length; i++) {
      const cr = clientRects[i];
      if (cr.width < 2 || cr.height < 2) continue;
      rawRects.push({
        top: cr.top - gridRect.top,
        bottom: cr.bottom - gridRect.top,
        right: cr.right - gridRect.left
      });
    }
  }
}
```

Für die Trust-Pills (`#hero-trust-pills`) und die Aktionsleiste (`#hero-actions-row`) ergänzen wir `rawRects` um die exakten Außenkanten jedes sichtbaren Kind-Buttons (`child.getBoundingClientRect()`). Dadurch sind sämtliche interaktiven Badges und Textfragmente in einem einheitlichen lokalen Koordinatensystem relativ zu `#hero-grid` erfasst.

### Schritt 2: 1D-Intervall-Merging zu horizontalen Konturbändern (`bands[]`)

Weil eine einzelne visuelle Bildschirmzeile aus mehreren DOM-Textknoten bestehen kann (beispielsweise normaler Text gefolgt von einem `<strong>`-Knoten in derselben Zeile), liefert `rawRects` zunächst mehrere Teilrechtecke auf gleicher vertikaler Höhe. Wir sortieren `rawRects` aufsteigend nach `top` und verschmelzen vertikal überlappende Rechtecke zu disjunkten horizontalen Konturbändern `bands`:

```javascript
rawRects.sort(function (a, b) { return a.top - b.top; });

const bands = [];
for (let i = 0; i < rawRects.length; i++) {
  const r = rawRects[i];
  if (bands.length === 0) {
    bands.push({ top: r.top, bottom: r.bottom, right: r.right });
    continue;
  }
  const last = bands[bands.length - 1];
  const verticalOverlap = Math.min(last.bottom, r.bottom) - Math.max(last.top, r.top);
  const minHeight = Math.min(last.bottom - last.top, r.bottom - r.top);
  const isSameLine = Math.abs(last.top - r.top) < 10 || verticalOverlap > minHeight * 0.35;

  if (isSameLine) {
    last.top = Math.min(last.top, r.top);
    last.bottom = Math.max(last.bottom, r.bottom);
    last.right = Math.max(last.right, r.right);
  } else {
    bands.push({ top: r.top, bottom: r.bottom, right: r.right });
  }
}
```

Zwei Fragmente gelten genau dann als dieselbe visuelle Zeile (`isSameLine`), wenn ihre Oberkanten um weniger als $10\text{ px}$ voneinander abweichen oder ihre vertikale Schnittmenge mehr als $35\,\%$ der kleineren Fragmenthöhe beträgt (`verticalOverlap > minHeight * 0.35`). Dieses Kriterium fängt auch Inline-Emojis (`🏙️`, `🏰`, `🌄`) und fetten Text mit minimal abweichender Baseline-Box zuverlässig in einem gemeinsamen Band $B_i = [\text{top}_i, \text{bottom}_i, \text{right}_i]$ ein.

## Wie berechnet der 2D-Optimierer die kollisionsfreie Porträt-Platzierung?

Der 2D-Platzierungs-Optimierer ermittelt auf Basis der extrahierten Konturbänder `bands[]` in Echtzeit die größtmögliche, garantiert überlappungsfreie Quadratfläche für das WebGL-Porträt ([`DepthPortrait.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/DepthPortrait.astro)), indem er zwei geometrische Kandidatenpositionen (*Rechts-Mittig* vs. *Oben neben H1*) gegeneinander auswertet. Reicht auf schmalen Smartphones der horizontale Freiraum für keinen der beiden Kandidaten bis zur Mindesthöhe der H1-Überschrift aus, blendet der Solver das Porträt sauber aus.

![2D Kollisionsfreier Porträt-Platzierungs-Solver mit Kandidat A Rechts-Mittig und Kandidat B Oben neben H1](./portrait_2d_placement_solver.svg "2D-Kollisions-Solver für das Hero-Porträt")

### Die Hindernisfunktion `maxRightInVerticalRange(yTop, yBottom)`

Gegeben sei ein vertikales Zielintervall $[y_{\text{top}}, y_{\text{bottom}}]$ für das Porträtquadrat der Kantenlänge $S$. Um jede optische Berührung mit den Textzeilen auszuschließen, definieren wir einen Sicherheitsabstand von $\text{PORTRAIT\_GAP\_X} = 18\text{ px}$ horizontal und $\text{PORTRAIT\_GAP\_Y} = 6\text{ px}$ vertikal. Die Funktion `maxRightInVerticalRange` bestimmt die am weitesten nach rechts ragende Textkante innerhalb dieses vertikalen Korridors:

$$\text{maxRight}(y_{\text{top}}, y_{\text{bottom}}) = \max \Big\{ b.\text{right} \;\Big|\; b \in \text{bands} \;\land\; b.\text{bottom} > y_{\text{top}} - 6 \;\land\; b.\text{top} < y_{\text{bottom}} + 6 \Big\}$$

Daraus folgt unmittelbar die minimal zulässige linke Startkoordinate $\text{reqLeft}$ des Porträts im Intervall $[y_{\text{top}}, y_{\text{bottom}}]$:

$$\text{reqLeft}(y_{\text{top}}, y_{\text{bottom}}) = \text{maxRight}(y_{\text{top}}, y_{\text{bottom}}) + 18\text{ px}$$

### Wettbewerb der zwei Platzierungs-Kandidaten

Der Solver in [`src/pages/index.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/index.astro#L1445-L1529) prüft nun zwei architektonisch sinnvolle Ankerpositionen innerhalb der Hero-Breite $W$ und Hero-Höhe $H$:

1. **Kandidat A – „Rechts-Mittig" (`sizeRightCenter`):**
   Auf Desktop- und breiten Tablet-Viewports soll das Porträt vertikal zentriert rechts neben dem gesamten Textblock schweben. Da eine größere Kantenlänge $S$ das vertikale Intervall $[(H - S)/2, (H + S)/2]$ aufweitet und dadurch potenziell längere Textzeilen in der Mitte einschließt, sucht der Solver absteigend ab $S_{\max} = \min(480, H)$ das größte Quadrat $S$, das kollisionsfrei in die verbleibende Breite passt:
   ```javascript
   let sizeRightCenter = 0;
   let reqLeftRightCenter = 0;
   const maxPossibleRightCenter = Math.min(480, gridHeight);
   for (let S = maxPossibleRightCenter; S >= 1; S--) {
     const yTop = (gridHeight - S) * 0.5;
     const yBottom = (gridHeight + S) * 0.5;
     const reqLeft = maxRightInVerticalRange(yTop, yBottom) + PORTRAIT_GAP_X;
     if (reqLeft + S <= gridWidth) {
       sizeRightCenter = S;
       reqLeftRightCenter = reqLeft;
       break;
     }
   }
   ```
2. **Kandidat B – „Oben neben H1" (`sizeTopRight`):**
   Auf mittleren Viewports, auf denen der Fließtext bereits fast die gesamte Breite einnimmt, die kurze `<h1>`-Überschrift (`max-w-[21rem]`) rechts oben jedoch noch eine Nische frei lässt, kann das Porträt bündig auf Höhe der H1 (`[0, h1Height]`) sitzen. Seine Kantenlänge ist exakt auf die Höhe der Überschrift $H_{\text{h1}}$ normiert, sofern $\text{gridWidth} - \text{reqLeft}(0, H_{\text{h1}}) \ge H_{\text{h1}}$ erfüllt ist.

### Auswahlregel, Hysterese und automatische Zentrierung im Restraum

Damit das Porträt niemals kleiner als die Hauptüberschrift wirkt, gilt die harte Untergrenze $S_{\min} = H_{\text{h1}}$. Zwischen beiden Kandidaten entscheidet der Solver zugunsten der zentrierten Hauptposition, sobald diese mindestens gleich groß oder innerhalb einer $4\text{ px}$-Rundungstoleranz liegt (`prefersCenter = sizeRightCenter + 4 >= sizeTopRight`). 

Sobald Position und Größe $S^*$ feststehen, wird das Porträt im verbleibenden freien Korridor $[\text{reqLeft}, W]$ exakt mittig ausgerichtet:

$$x_{\text{left}} = \text{round}\!\left(\text{reqLeft} + \frac{W - \text{reqLeft} - S^*}{2}\right)$$

Ergänzend passt die vorangestellte Routine in [`src/pages/index.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/index.astro#L1267-L1312) den primären Kontakt-Button (`#hero-contact-btn`) dreistufig an den verfügbaren Platz an (*„Get in Touch"* $\rightarrow$ *„Contact"* $\rightarrow$ *Envelope-Icon*), sodass die Aktionszeile auf keinem Viewport jemals ungewollt umbricht.

## Wie formt ein 2D Signed Distance Field (SDF) das reaktive Punktraster um die Textkontur?

Ein zweidimensionales Signed Distance Field (2D SDF) ordnet jedem Gitterpunkt $(x_0, y_0)$ des Hintergrund-Canvas seinen kürzesten vorzeichenbehafteten euklidischen Abstand zur nächstgelegenen Textzeile und zum äußeren Hero-Rahmen zu. Durch die Verknüpfung abgerundeter Box-Distanzfunktionen (`sdRoundRect`) über Inigo Quilez' polynomielles Smooth Minimum (`smin`) entsteht eine organisch gerundete L-förmige Ausschnittskontur mit weichem 32-Pixel-Opazitätsübergang.

![Architektur-Skizze der TreeWalker-Konturbänder und des 2D-SDF-Gitters am Whiteboard im Almtal Home Office](./treewalker-sdf-whiteboard.jpg "Whiteboard-Architektur: TreeWalker-Bänder, Quilez smin und 2D-SDF-Punktraster")

Nachdem `syncHeroResponsiveLayout()` die Konturbänder `bands[]` berechnet hat, serialisiert das Skript die ganzzahligen Tripel `[Math.round(b.top), Math.round(b.bottom), Math.ceil(b.right)]` in das Attribut `data-contour` der Komponente [`ReactiveDotGrid.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/ReactiveDotGrid.astro) und feuert das Event `dotgrid:layout`.

### 1. Exakte 2D-Distanzfunktion eines abgerundeten Rechtecks (`sdRoundRect`)

Klassische SDF-Verfahren wurden in der Echtzeit-Computergrafik durch [@green-2007-alpha-tested-magnification] für randscharfe Vektortexturen etabliert und von [@quilez-2018-distfunctions2d] für analytische 2D-Primitiven verallgemeinert. Für einen Gitterpunkt $\mathbf{p} = (p_x, p_y)$ und ein achsenparalleles Rechteck $[x_L, x_R] \times [y_T, y_B]$ mit Mittelpunkt $\mathbf{c}$, Halbausdehnung $\mathbf{h} = (h_w, h_h)$ und Eckenradius $r_{\text{eff}} = \min(r, h_w, h_h)$ lautet die exakte vorzeichenbehaftete Distanz:

$$\mathbf{q} = |\mathbf{p} - \mathbf{c}| - (\mathbf{h} - r_{\text{eff}})$$

$$d_{\text{roundRect}}(\mathbf{p}) = \|\max(\mathbf{q}, \mathbf{0})\|_2 + \min(\max(q_x, q_y), 0) - r_{\text{eff}}$$

Dabei gilt:
- $d < 0$: Der Punkt liegt **innerhalb** des Rechtecks.
- $d = 0$: Der Punkt liegt exakt auf der abgerundeten Konturlinie.
- $d > 0$: Der Punkt liegt **außerhalb** des Rechtecks, und $d$ entspricht dem exakten euklidischen Pixelabstand zur nächstgelegenen Kante oder Ecke.

### 2. Organische $C^1$-Stufenverschmelzung mit Quilez' Polynomial `smin`

Würde man die Distanz zum gesamten Textblock schlicht als hartes Minimum $\min_i d_i(\mathbf{p})$ über alle Zeilenbänder $i$ berechnen, entstünden an jedem Zeilenumbruch-Rücksprung scharfe $90^\circ$-Knicke im Gradientenfeld. Um diese Treppenstufen wie eine flüssige Membran abzurunden, setzen wir das polynomielle *Smooth Minimum* (`smin`) nach [@quilez-2013-smin] ein:

$$h = \frac{\max(k - |a - b|, 0)}{k}, \qquad \text{smin}(a, b, k) = \min(a, b) - \frac{1}{4} h^2 k$$

In [`ReactiveDotGrid.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/ReactiveDotGrid.astro#L150-L185) bestimmen wir für jeden Punkt des $22\text{ px}$-Gitters die zwei kleinsten Distanzen $d_1 \le d_2$ zu allen um $\text{CLEARANCE\_X} = 16\text{ px}$ und $\text{CLEARANCE\_Y} = 14\text{ px}$ aufgeweiteten Zeilenbändern und verschmelzen sie mit Radius $k = 12$:

```typescript
let d1 = Infinity;
let d2 = Infinity;
for (let i = 0; i < bands.length; i++) {
  const b = bands[i];
  const d = sdRoundRect(
    x0,
    y0,
    -500,
    b[0] - CLEARANCE_Y,
    b[2] + CLEARANCE_X,
    b[1] + CLEARANCE_Y,
    12
  );
  if (d < d1) {
    d2 = d1;
    d1 = d;
  } else if (d < d2) {
    d2 = d;
  }
}
const dText = d2 < Infinity ? smin(d1, d2, 12) : d1;

// Hard Culling innerhalb der Text-Sicherheitszone
if (dText <= 0) continue;

// Konkave Ausrundung (Fillet) zwischen Außenrahmen (-dOuter) und Textkontur (dText)
const distInsideOpen = smin(-dOuter, dText, 22);
```

Ein zweiter Aufruf `smin(-dOuter, dText, 22)` verrundet zusätzlich die konkaven Innenecken, an denen die Textkolumne oben und unten auf den abgerundeten Hero-Außenrahmen (`dOuter`) trifft. Anschließend moduliert eine kubische Hermite-Interpolation (`smoothstep(0, 32, dText)`) die Punkt-Opazität sanft von $0$ (direkt an der Sicherheitsgrenze) auf $1$ (ab $32\text{ px}$ Abstand).

![Vierstufige 2D Signed Distance Field und Canvas-Batching-Pipeline in ReactiveDotGrid.astro](./sdf_smin_lattice_pipeline.svg "4-Stufen-Pipeline: 2D Box-SDF, Quilez smin, Smoothstep und 10-Bucket Canvas-Batching")

## Wie erreichen wir 60 FPS durch 10-Bucket Opacity Quantisierung und Feder-Dämpfer-Physik?

Um trotz hunderter individuell abgedunkelter und animierter Gitterpunkte konstant 60 FPS bei minimaler CPU-Last zu garantieren, quantisiert `ReactiveDotGrid.astro` die kontinuierliche SDF-Randopazität beim Gitteraufbau in exakt zehn diskrete Opazitäts-Buckets (`alphaBin = 0..9`). Während der Render-Schleife werden sämtliche Ruhelage-Punkte eines Buckets in einem einzigen gemeinsamen `ctx.beginPath()`- und `ctx.fill()`-Aufruf gezeichnet, was hunderte einzelne Canvas-State-Wechsel auf maximal zehn gebündelte Draw-Calls pro Frame reduziert.

### 10-Bucket Opacity Batching im HTML5 2D Canvas

Im unmittelbaren Modus (*Immediate Mode*) der HTML5 Canvas 2D API ist nicht die Berechnung von `Math.sin` oder `ctx.arc` der Flaschenhals, sondern das ständige Umschalten von `ctx.fillStyle` und das Absenden hunderter einzelner `ctx.fill()`-Befehle an den Grafiktreiber. Da sich die statische Randabschwächung `alphaFactor = textAlpha * cornerAlpha` jedes Punktes nur bei einem Resize ändert, diskretisieren wir sie bereits in `rebuildLattice()` in zehn Stufen und sortieren das Punkt-Array aufsteigend nach `alphaBin`:

```typescript
const alphaFactor = textAlpha * cornerAlpha;
if (alphaFactor < 0.04) continue;

const alphaBin = Math.min(9, Math.floor(alphaFactor * 10));
// ...
dots.sort((a, b) => a.alphaBin - b.alphaBin);
```

In der `draw()`-Schleife iteriert der Renderer über die zehn Buckets $b \in \{0, \dots, 9\}$, setzt `ctx.fillStyle` ein einziges Mal pro Bucket und fügt alle zugehörigen Kreise mittels `ctx.moveTo(x + r, y)` und `ctx.arc(x, y, r, 0, Math.PI * 2)` demselben Subpfad hinzu:

```typescript
for (let bin = 0; bin < 10; bin++) {
  if (idx >= len || dots[idx].alphaBin > bin) continue;

  const binAlpha = baseAlpha * ((bin + 0.5) / 10);
  ctx.fillStyle = `rgba(${baseRgb}, ${binAlpha.toFixed(3)})`;
  ctx.beginPath();

  while (idx < len && dots[idx].alphaBin === bin) {
    const dot = dots[idx];
    idx++;
    if (dot.energy > 0.005) {
      energizedDots.push(dot);
      continue;
    }
    const x = dot.x0 + dot.dx;
    const y = dot.y0 + dot.dy;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}
```

Lediglich die wenigen Punkte im unmittelbaren Maus-Einflussradius (`dot.energy > 0.005`), deren Farbe dynamisch zwischen dem ruhigen Slate-Ton und unseren Markenfarben (`#3b82f6` Brand Blue / `#a855f7` Brand Purple) interpoliert wird, werden in `energizedDots` gesammelt und separat gezeichnet.

### Semi-implizite Feder-Dämpfer-ODE und Zwei-Barrieren-First-Paint-Gate

Bewegt sich der Mauszeiger im Abstand $d < R_{\text{inf}} = 115\text{ px}$ über das Gitter, erfahren die Punkte eine radiale Abstoßung mit glattem Sinus-Profil:

$$\Delta_{\text{target}}(d) = \Delta_{\max} \cdot \left(1 - \frac{d}{R_{\text{inf}}}\right)^2 \cdot \sin\!\left(\left(1 - \frac{d}{R_{\text{inf}}}\right)\pi\right), \qquad \Delta_{\max} = 7.5\text{ px}$$

Die Rückkehr in die Ruhelage $(x_0, y_0)$ folgt einer semi-impliziten Euler-Integration eines gedämpften harmonischen Oszillators mit Federsteifigkeit $k = 150$ und Dämpfungskoeffizient $c = 18$:

$$a_x = -k (x - x_{\text{target}}) - c v_x, \qquad a_y = -k (y - y_{\text{target}}) - c v_y$$

Mit einer kritischen Dämpfungsrate von $\zeta = \frac{c}{2\sqrt{k}} = \frac{18}{2\sqrt{150}} \approx 0.735$ schwingen ausgelenkte Gitterpunkte geschmeidig und ohne nervöses Nachzittern in ihre Gleichgewichtslage zurück.

Damit beim ersten Seitenaufruf weder ein unfertiger Webfont-Umbruch (*Flash of Unstyled Text*) noch ein verspätetes WebGL-Textur-Laden zu einem sichtbaren Umspringen der Kontur führt, synchronisiert [`src/pages/index.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/index.astro#L1549-L1615) die Freigabe über ein deterministisches **Zwei-Barrieren-Gate**:

1. **Barriere 1 (`isFontsReady`):** Prüft synchron via `document.fonts.check('800 60px Outfit')` oder wartet auf das im W3C CSS Font Loading Standard [@w3c-2014-css-font-loading] definierte Promise `document.fonts.ready` (abgesichert durch einen $180\text{ ms}$ Fallback-Timer). Erst wenn die finalen Outfit-Glyphenmetriken aktiv sind, vermisst `syncHeroResponsiveLayout()` die Textzeilen und startet die gestaffelte Radial-Intro-Welle (`dotgrid:intro`).
2. **Barriere 2 (`isPortraitReady`):** Lauscht auf das Custom Event `portrait:ready` des WebGL-Porträts (mit $1500\text{ ms}$ Sicherheits-Timeout). Erst wenn `isFontsReady && isPortraitReady` erfüllt ist, schaltet `#hero-portrait-cell` von `visibility: hidden; opacity: 0` weich auf sichtbar.

## Fazit: Fünf Architektur-Prinzipien für geometriebewusste Web-Interfaces

Die Verknüpfung von DOM-Text-Geometrie und analytischen 2D-Distanzfeldern zeigt, dass moderne Web-Frontends nicht an die starren Grenzen rechteckiger CSS-Block-Container gebunden sind:

1. **Sub-Element-Vermessung statt Block-Box-Verschnitt:** `document.createTreeWalker(el, NodeFilter.SHOW_TEXT)` in Kombination mit `Range.getClientRects()` erschließt die wahre Zeilenkontur von Fließtext und Überschriften.
2. **1D-Intervall-Merging als robuste Geometrie-Brücke:** Das Zusammenführen einzelner Textknoten-Rechtecke über einen $35\,\%$-Überlappungs-Schwellenwert reduziert hunderte DOM-Fragmente auf wenige kompakte Konturbänder `bands[]`.
3. **Deterministische 2D-Constraint-Optimierung statt starrer Breakpoints:** Ein expliziter Kandidaten-Solver (*Rechts-Mittig* vs. *Oben neben H1*) nutzt jeden freien Pixel über alle Viewport-Breiten hinweg kollisionsfrei aus.
4. **Analytische 2D-SDFs mit `smin`-Filleting:** Die Kombination aus `sdRoundRect` und Inigo Quilez' polynomieller `smin`-Funktion formt harte Treppenstufen in organisch fließende Freiräume um.
5. **10-Bucket Opacity Batching & Font-Ready-Gates:** Die Quantisierung kontinuierlicher SDF-Opazitäten auf zehn Canvas-Draw-Calls pro Frame sowie das `document.fonts.ready`-Synchronisations-Gate verbinden mathematische Präzision mit 60-FPS-Effizienz und **CLS = 0**.
