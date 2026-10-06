---
title: "Computer-Simulation"
description: "Unterlagen für meinen Kurs in Computer-Simulation an der Fakultät für Technik und angewandte Naturwissenschaften der FH OÖ."
repoName: "kurs-computer-simulation"
learningGoals:
  - "Verstehen der mathematischen Grundlagen diskreter und kontinuierlicher Simulationsmodelle."
  - "Implementierung von Simulationsalgorithmen in C# und anderen objektorientierten Sprachen."
  - "Statistische Auswertung und kritische Analyse von Simulationsergebnissen."
terms:
  - "Winter Term 2025/26"
language: "de"
screenshot:
  src: "./preview.jpg"
  title: "Computer-Simulation: Taxonomie der Simulationsmodelle"
  description: "Hierarchischer Taxonomie-Baum von Simulationsmodellen: Statisch vs. dynamisch, kontinuierlich vs. diskret sowie Fixed-Step vs. Next-Event Time Advance mit thematischen Icons"
tags:
  - "simulation"
  - "manufacturing-systems"
  - "teaching"
overview: "Rechnergestützte Simulation ist eine Kernkompetenz zur Analyse, Validierung und Optimierung komplexer technischer Systeme. Der Kurs vermittelt die mathematischen Grundlagen, algorithmischen Paradigmen und die objektorientierte Programmierung diskreter und kontinuierlicher Simulatoren in C#."
targetAudience: "Bachelor- und Master-Studierende der Fachrichtung Informatik, Mechatronik und Automatisierungstechnik sowie Simulationsingenieure."
prerequisites:
  - "Solide Kenntnisse in objektorientierter Programmierung (vorzugsweise C# oder Java)"
  - "Grundlagen der Wahrscheinlichkeitsrechnung und Statistik"
  - "Verständnis elementarer Datenstrukturen (Queues, Prioritätswarteschlangen, Graphen)"
competencies:
  - title: "Taxonomie & Paradigmen"
    description: "Klassifikation statischer vs. dynamischer und kontinuierlicher vs. diskreter Simulationssysteme."
    icon: "🗺️"
  - title: "Simulations-Engine Entwicklung"
    description: "Eigenständige Implementierung eines Next-Event Time Advance Simulators in C#."
    icon: "⚙️"
  - title: "Zufall & Stochastik"
    description: "Pseudozufallsgeneratoren, Inversionsmethode und Modellierung stochastischer Prozesse."
    icon: "🎲"
  - title: "Verifikation & Validierung"
    description: "Statistische Absicherung von Simulationsergebnissen, Konfidenzintervalle und Sensitivitätsanalyse."
    icon: "📊"
syllabus:
  - moduleNumber: "01"
    title: "Grundlagen & Taxonomie der Simulation"
    description: "Einführung in Systembegriff, Modelle, Zeitfortschrittsmechanismen und Modellklassifikation."
    topics:
      - "Systemgrenzen, Zustandsgrößen und Modellabstraktion"
      - "Fixed-Step vs. Next-Event Time Advance"
      - "Klassifikationsmatrix: Deterministisch vs. Stochastisch"
    tools:
      - "UML"
      - "Markdown"
  - moduleNumber: "02"
    title: "Stochastische Modellierung & Zufallsvariablen"
    description: "Erzeugung von Pseudozufallszahlen, statistische Verteilungen und Anpassungstests."
    topics:
      - "Linear Congruential Generators (LCG)"
      - "Inversionsmethode & Transformationsverfahren"
      - "Chi-Quadrat- und Kolmogorov-Smirnov-Anpassungstests"
    tools:
      - "C#"
      - "LINQPad"
  - moduleNumber: "03"
    title: "Architektur einer Discrete-Event-Engine"
    description: "Objektorientierter Entwurf einer ereignisdiskreten Simulations-Engine in modernem C#."
    topics:
      - "Event-Kalender & Prioritätswarteschlangen"
      - "Entities, Ressourcen und Warteschlangenstrategien"
      - "Zustandsbeobachtung und Telemetrieerfassung"
    tools:
      - "C# / .NET"
      - "Visual Studio"
  - moduleNumber: "04"
    title: "Kontinuierliche & Hybride Systeme"
    description: "Numerische Integration gewöhnlicher Differentialgleichungen und hybride Zustandsübergänge."
    topics:
      - "Explizites Euler-Verfahren & Runge-Kutta (RK4)"
      - "Schrittweitensteuerung & numerische Stabilität"
      - "Hybride Trigger und Schwellwert-Ereignisse"
    tools:
      - "C#"
      - "MathNet.Numerics"
  - moduleNumber: "05"
    title: "Verifikation, Validierung & Experimentalanalyse"
    description: "Statistische Auswertung von Simulationsläufen, Einschwingphasen und Hypothesentests."
    topics:
      - "Einschwingphase (Warm-up Period Detection)"
      - "Batch-Means-Verfahren & Replikationsanalyse"
      - "Modellvalidierung gegenüber Realsystemdaten"
    tools:
      - "Python"
      - "Jupyter Notebook"
---

