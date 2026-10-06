---
title: "Datenanalyse und SQL"
description: "Unterlagen für meinen Kurs in Datenanalyse. Einführung in relationale Datenbanken, SQL-Abfragen, analytische Datenstrukturen und Werkzeuge zur Datenauswertung."
repoName: "kurs-datenanalyse"
learningGoals:
  - "Konzipieren und Abfragen relationaler Datenbanken mittels komplexer SQL-Anweisungen."
  - "Verstehen von Analytical Processing (OLAP) und Data-Warehouse-Konzepten."
  - "Visualisierung von Messdaten und Interpretation von statistischen Analysen."
terms:
  - "Summer Term 2025"
language: "de"
screenshot:
  src: "./preview.jpg"
  title: "Datenanalyse und SQL: Relationale Schemata & Analyse-Pipeline"
  description: "Orthogonale Schautafel einer Datenpipeline mit relationalen Datenbankschemata, SQL-Aggregations- und Filtertrichter sowie analytischen Metrik- und Trendkarten"
tags:
  - "data-integration"
  - "python"
  - "teaching"
overview: "Daten sind die entscheidende Grundlage moderner Industrie- und Geschäftsprozesse. Dieser Kurs schlägt die Brücke von relationaler Modellierung und performanten SQL-Abfragen über analytische Data-Warehouse-Architekturen (OLAP) bis hin zur explorativen Datenanalyse und interaktiven Dashboard-Erstellung."
targetAudience: "Studierende der Fachrichtungen Wirtschaftsinformatik, Informatik und Data Science sowie Fach- und Führungskräfte mit Interesse an fundierter Datenanalyse."
prerequisites:
  - "Grundlegendes Verständnis logischer Datenzusammenhänge und Tabellenstrukturen"
  - "Elementare mathematische Kenntnisse (Grundrechenarten, Statistik, Prozentrechnung)"
  - "Keine tiefen SQL-Vorkenntnisse erforderlich"
competencies:
  - title: "Relationale Modellierung & SQL"
    description: "Entwurf normalisierter Datenbankschemata und Formulierung komplexer analytischer SQL-Queries."
    icon: "🗄️"
  - title: "Data Warehousing & OLAP"
    description: "Konzeption dimensionaler Schemata (Stern- und Schneeflockenarchitektur) für Massendatenanalysen."
    icon: "🏢"
  - title: "Explorative Datenaufbereitung"
    description: "Identifikation von Ausreißern, Umgang mit Nullwerten und Feature-Transformationen."
    icon: "🧹"
  - title: "Visual Analytics & Dashboards"
    description: "Gestaltung verständlicher Visualisierungen und KPI-Berichte für Entscheidungsträger."
    icon: "📊"
syllabus:
  - moduleNumber: "01"
    title: "Relationale Datenbanksysteme & Modellierung"
    description: "Entity-Relationship-Modelle (ERM), Relationen, Primär-/Fremdschlüssel und Normalformen (1NF bis 3NF)."
    topics:
      - "ER-Diagramme & Übersetzung in relationale Schemata"
      - "Integritätsbedingungen & Constraints"
      - "Normalisierungstheorie und Redundanzvermeidung"
    tools:
      - "PostgreSQL"
      - "DBeaver"
  - moduleNumber: "02"
    title: "Fortgeschrittene SQL-Abfragen"
    description: "Multi-Table JOINs, Subqueries, Aggregationen, HAVING-Filter und Window Functions."
    topics:
      - "Inner, Left, Right & Full Outer JOINs"
      - "GROUP BY, Aggregatfunktionen und ROLLUP/CUBE"
      - "Fensterfunktionen (OVER, PARTITION BY, RANK)"
    tools:
      - "SQL"
      - "PostgreSQL"
  - moduleNumber: "03"
    title: "Data Warehouse & Dimensional Modeling"
    description: "OLTP vs. OLAP, Fakten- und Dimensionstabellen, Stern- und Schneeflockenschema."
    topics:
      - "Dimensionale Modellierung nach Kimball"
      - "Slowly Changing Dimensions (SCD Typ 1–3)"
      - "ETL/ELT-Pipelinekonzepte"
    tools:
      - "SQL Data Warehouse"
  - moduleNumber: "04"
    title: "Explorative Datenanalyse & Statistik"
    description: "Statistische Lage- und Streuungsmaße, Korrelationsanalysen und Datenbereinigung."
    topics:
      - "Deskriptive Kennzahlen: Mittelwert, Median, Quantile"
      - "Erkennung und Bereinigung fehlerhafter Datensätze"
      - "Pivotierung und Kreuztabellen"
    tools:
      - "Python"
      - "Pandas"
  - moduleNumber: "05"
    title: "Business Intelligence & Dashboarding"
    description: "Aufbau interaktiver Dashboards, Chart-Junk-Vermeidung und KPI-Monitoring."
    topics:
      - "Wahl geeigneter Diagrammtypen"
      - "Filterung, Drill-Down und Drill-Through"
      - "Storytelling mit Daten & Reporting-Richtlinien"
    tools:
      - "Metabase"
      - "Power BI"
---

