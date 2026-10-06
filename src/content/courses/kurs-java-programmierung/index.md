---
title: "Java-Programmierung"
description: "Unterlagen für meinen Einführungskurs in die Java-Programmierung an der Fakultät für Technik und angewandte Naturwissenschaften der FH OÖ."
repoName: "kurs-java-programmierung"
learningGoals:
  - "Verständnis der Kernkonzepte der objektorientierten Programmierung (OOP) wie Vererbung und Polymorphie."
  - "Beherrschung der Java-Syntax, Collections Framework und Ausnahmebehandlung (Exception Handling)."
  - "Entwicklung modularer, testbarer Desktop- und Konsolenanwendungen mit Java."
terms:
  - "Winter Term 2024/25"
  - "Winter Term 2025/26"
language: "de"
screenshot:
  src: "./preview.jpg"
  title: "Java-Programmierung: Eclipse IDE & Sprachelemente"
  description: "Orthogonale Schautafel der Java-Entwicklung in der Eclipse IDE mit Package Explorer, Java-Kaffeebecher-Symbol, Syntax-Editor und Konsole"
tags:
  - "java"
  - "software-engineering"
  - "teaching"
overview: "Java gehört weltweit zu den verlässlichsten und meistgenutzten Programmiersprachen für robuste Unternehmenssoftware und Backend-Services. Dieser Einführungskurs führt systematisch von den Grundlagen der imperativen Programmierung über fortgeschrittene objektorientierte Konzepte bis hin zu generischen Collections und automatisierter Qualitätssicherung mit JUnit."
targetAudience: "Bachelor-Studierende der Fachrichtung Informatik und verwandter technischer Studiengänge sowie Berufseinsteiger in die Softwareentwicklung."
prerequisites:
  - "Grundlegendes logisches Denkvermögen und Computer-Grundkenntnisse"
  - "Verständnis elementarer mathematischer Funktionen und Variablen"
  - "Keine vorherige Programmiererfahrung zwingend erforderlich"
competencies:
  - title: "Imperative Programmierung & Syntax"
    description: "Sicherer Umgang mit Java-Typen, Kontrollstrukturen, Methoden und Speichermodellen."
    icon: "☕"
  - title: "Objektorientierte Modellierung"
    description: "Implementierung von Vererbung, Kapselung, Polymorphie und abstrakten Schnittstellen."
    icon: "🧩"
  - title: "Collections & Datenstrukturen"
    description: "Effizienter Einsatz generischer Listen, Sets und HashMaps für dynamische Datenmengen."
    icon: "📚"
  - title: "Testautomatisierung mit JUnit"
    description: "Schreiben isolierter automatisierter Komponententests und strukturierte Fehlerbehandlung."
    icon: "🧪"
syllabus:
  - moduleNumber: "01"
    title: "Java-Plattform & Sprachgrundlagen"
    description: "JVM, Bytecode, Compiler, primitive Datentypen, Operatoren und Kontrollstrukturen."
    topics:
      - "JDK, JRE und die Rolle der Java Virtual Machine"
      - "Primitive Typen, Referenztypen und Typkonvertierung"
      - "Schleifen (for, while), Verzweigungen (if-else, switch)"
    tools:
      - "Java 21"
      - "IntelliJ IDEA"
  - moduleNumber: "02"
    title: "Klassen, Objekte & Kapselung"
    description: "Klassenbaupläne, Attribute, Methoden, Konstruktoren und Zugriffsmodifikatoren."
    topics:
      - "Instanziierung, Heap- und Stack-Speicher"
      - "Sichtbarkeiten (private, package, protected, public)"
      - "Getter, Setter und Invariantenabsicherung"
    tools:
      - "Java"
  - moduleNumber: "03"
    title: "Vererbung, Interfaces & Polymorphie"
    description: "Hierarchische Beziehungen, Subtyping, dynamische Bindung und Schnittstellendesign."
    topics:
      - "Abstrakte Klassen vs. Interfaces"
      - "Methodenüberschreibung (@Override) und Super-Aufrufe"
      - "Laufzeitpolymorphie und Pattern Matching"
    tools:
      - "Java"
      - "UML"
  - moduleNumber: "04"
    title: "Generics & das Java Collections Framework"
    description: "Typsichere Datenstrukturen: List, Set, Map und deren Implementierungen."
    topics:
      - "ArrayList vs. LinkedList"
      - "HashSet, TreeSet und equals/hashCode-Vertrag"
      - "HashMap, TreeMap und Key-Value-Muster"
    tools:
      - "Java Collections"
  - moduleNumber: "05"
    title: "Exception Handling, I/O & JUnit Testing"
    description: "Robuste Fehlerbehandlung mit Exceptions, Dateizugriff und Testautomatisierung."
    topics:
      - "Checked vs. Unchecked Exceptions (try-catch-finally)"
      - "Streams, Scanner und Dateipfade (java.nio)"
      - "Test-Driven Development und Assertions mit JUnit 5"
    tools:
      - "JUnit 5"
      - "Maven"
---

