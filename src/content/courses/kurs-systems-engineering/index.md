---
title: "Systems Engineering"
description: "Unterlagen für meinen Kurs in Systems Engineering mit MATLAB und Simulink an der Fakultät für Technik und angewandte Naturwissenschaften der FH OÖ."
repoName: "kurs-systems-engineering"
learningGoals:
  - "Verstehen der Prinzipien des Model-Based Systems Engineering (MBSE)."
  - "Erstellung mathematischer Simulationsmodelle in MATLAB und Simulink."
  - "Regelungsentwurf und Stabilitätsanalyse mechatronischer Systeme."
terms:
  - "Winter Term 2025/26"
language: "de"
screenshot:
  src: "./preview.jpg"
  title: "Systems Engineering: Black-Box/White-Box & Test Harness"
  description: "Orthogonale Schautafel des Systems Engineerings mit Test Suite, Systemgrenze als Black-Box- und White-Box-Modell, Schnittstellen-Ports und Test Harness"
tags:
  - "systems-engineering"
  - "systems-analysis"
  - "systems-design"
  - "systems-verification"
  - "teaching"
overview: "Komplexe mechatronische und cyber-physische Systeme erfordern eine interdisziplinäre, modellbasierte Sichtweise (Model-Based Systems Engineering, MBSE). Dieser Kurs führt von den V-Modell-Grundlagen über die physikalisch-mathematische Modellierung in MATLAB/Simulink bis hin zum regelungstechnischen Reglerentwurf und systematischer Testabsicherung."
targetAudience: "Bachelor- und Master-Studierende der Fachrichtungen Mechatronik, Automatisierungstechnik, Systems Engineering und Informatik."
prerequisites:
  - "Gute mathematische Grundlagen (Analysis, lineare Algebra, gewöhnliche Differentialgleichungen)"
  - "Grundverständnis physikalischer Gesetze (Mechanik, Elektrotechnik)"
  - "Erste Erfahrungen im Umgang mit numerischen Entwicklungsumgebungen"
competencies:
  - title: "Model-Based Systems Engineering (MBSE)"
    description: "Strukturierung mechatronischer Systeme nach dem V-Modell mit Black-Box/White-Box-Abstraktionen."
    icon: "📐"
  - title: "Mathematische Dynamik-Modellierung"
    description: "Überführung physikalischer Systeme in Differentialgleichungen und Übertragungsfunktionen."
    icon: "🧮"
  - title: "Simulation in Simulink"
    description: "Aufbau hierarchischer Blockdiagramme, Solver-Parametrierung und Zustandsraum-Modelle."
    icon: "⚙️"
  - title: "Regelung & Stabilitätsanalyse"
    description: "Entwurf von PID-Regelkreisen, Stabilitätsbewertung im Bodediagramm und Sprungantwortanalyse."
    icon: "📈"
syllabus:
  - moduleNumber: "01"
    title: "Einführung in Systems Engineering & V-Modell"
    description: "Systemdenken, Stakeholder-Anforderungen, Systemgrenzen, Black-Box- vs. White-Box-Modelle."
    topics:
      - "Das V-Modell im Produktlebenszyklus"
      - "Schnittstellendefinition und Port-Architekturen"
      - "Funktionale Dekomposition & Requirements Tracing"
    tools:
      - "SysML"
      - "UML"
  - moduleNumber: "02"
    title: "Physikalisch-mathematische Systemmodellierung"
    description: "Aufstellen von Bewegungsgleichungen mechanischer und elektrischer Netzwerke."
    topics:
      - "Differentialgleichungen 1. und 2. Ordnung"
      - "Laplace-Transformation & Übertragungsfunktionen"
      - "Linearisierung um Arbeitspunkte"
    tools:
      - "MATLAB"
  - moduleNumber: "03"
    title: "Blockdiagramme & Simulation in Simulink"
    description: "Modellerstellung in Simulink, kontinuierliche Integratoren, Signalquellen und Senken."
    topics:
      - "Hierarchische Subsysteme und Bus-Signale"
      - "Numerische Solver (Fixed-Step vs. Variable-Step ODEs)"
      - "Diskrete Signalabtastung und Abtastzeiten"
    tools:
      - "Simulink"
  - moduleNumber: "04"
    title: "Klassische Regelungstechnik & PID-Entwurf"
    description: "Rückkopplungsschleifen, Führungs- und Störverhalten, PID-Parametrierung und Anti-Windup."
    topics:
      - "Offener vs. geschlossener Regelkreis"
      - "Ziegler-Nichols & Einstellregeln"
      - "Aktuator-Begrenzungen und Integrator-Windup"
    tools:
      - "Simulink Control Design"
  - moduleNumber: "05"
    title: "Stabilitätsbewertung & Systemverifikation"
    description: "Frequenzbereichsanalyse mit Bodediagramm, Phasenrand, Test Harness und automatisierte HIL-Tests."
    topics:
      - "Frequenzkennlinien (Bode-Diagramme)"
      - "Amplituden- und Phasenreserve"
      - "Simulink Test Harness & Systemvalidierung"
    tools:
      - "MATLAB Control Toolbox"
      - "Simulink Test"
---

