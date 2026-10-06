---
title: "Web-Programmierung mit TypeScript"
description: "Unterlagen für meinen Kurs in Web-Programmierung mit TypeScript und Firebase. Einstieg in die moderne Webentwicklung."
repoName: "kurs-typescript-firebase"
learningGoals:
  - "Sichere Anwendung von TypeScript-Features wie statischer Typisierung und Interfaces im Webkontext."
  - "Integration einer Cloud-Datenbank (Google Cloud Firestore) und Authentifizierung in Web-Apps."
  - "Erstellung und Bereitstellung interaktiver Single-Page-Anwendungen (SPAs) auf Firebase Hosting."
terms:
  - "Winter Term 2024/25"
language: "de"
screenshot:
  src: "./preview.jpg"
  title: "Web-Programmierung: TypeScript Frontend & Firebase Cloud-Sync"
  description: "Orthogonale Schautafel eines typisierten Web-Browser-Frontends mit UI-Komponenten und synchronisierter Cloud-Dokumentendatenbank"
tags:
  - "typescript"
  - "web-development"
  - "teaching"
overview: "Moderne Webanwendungen verlangen typsichere Frontend-Architekturen und reaktive, hochverfügbare Cloud-Backends. Dieser Kurs vermittelt die Full-Stack-Webentwicklung mit TypeScript und der Serverless-Plattform Google Firebase – von statischer Typisierung und DOM-Manipulation über Firestore-Echtzeitsynchronisation bis hin zu Produktions-Deployments via Firebase Hosting."
targetAudience: "Bachelor-Studierende der Fachrichtung Informatik sowie Webentwickler, die moderne Single-Page-Apps mit TypeScript und serverlosen Cloud-Diensten realisieren wollen."
prerequisites:
  - "Grundlegendes Verständnis von HTML-Strukturen und CSS-Styling"
  - "Elementare Programmierkenntnisse (Variablen, Bedingungen, Schleifen)"
  - "Familiarität mit modernen Webbrowsern und Entwicklertools"
competencies:
  - title: "Statisches TypeScript-Typing"
    description: "Sichere Beherrschung von Interfaces, Generics, Union-Typen und Type-Guards im Webkontext."
    icon: "🔷"
  - title: "Reaktive DOM-Manipulation"
    description: "Komponentenorientierte Benutzeroberflächen mit modernem JavaScript (ES6+), Fetch und Async/Await."
    icon: "🌐"
  - title: "Cloud Firestore & NoSQL"
    description: "Modellierung dokumentenbasierter NoSQL-Datenbanken und Echtzeit-Synchronisation mit Snapshots."
    icon: "🔥"
  - title: "Auth & Serverless Deployment"
    description: "Benutzerauthentifizierung, granulare Sicherheitsregeln (Rules) und Hosting-Pipelines."
    icon: "🛡️"
syllabus:
  - moduleNumber: "01"
    title: "TypeScript-Sprachkonzepte & Compiler"
    description: "TypeScript-Compiler (tsc), Konfiguration (tsconfig), statische Typisierung und Typinferenz."
    topics:
      - "Primitive Typen, Union Types & Type Aliases"
      - "Interfaces, optionale Properties und Readonly"
      - "Generics, Enums und Type Narrowing"
    tools:
      - "TypeScript"
      - "VS Code"
      - "Node.js"
  - moduleNumber: "02"
    title: "Moderne Web-Standards & DOM-Interaktion"
    description: "HTML5-Semantik, CSS3-Flexbox/Grid, typed DOM-Events und asynchrones JavaScript."
    topics:
      - "DOM-Querying mit Type-Casting"
      - "Event-Listener und Event-Delegation"
      - "Asynchrone Web-APIs und Fetch-Requests"
    tools:
      - "Chrome DevTools"
      - "Vite"
  - moduleNumber: "03"
    title: "Firebase Setup & Authentication"
    description: "Initialisierung des Firebase SDKs, E-Mail/Passwort- und OAuth-Provider sowie Session-State-Listener."
    topics:
      - "Firebase Projektkonfiguration & API-Keys"
      - "User Sign-Up, Sign-In und Sign-Out"
      - "AuthStateChanged-Observer und geschützte Routen"
    tools:
      - "Firebase SDK"
      - "Google Cloud Console"
  - moduleNumber: "04"
    title: "Echtzeitdatenbank Cloud Firestore"
    description: "Collections, Documents, CRUD-Operationen, Subcollections und reaktive onSnapshot-Echtzeit-Listener."
    topics:
      - "NoSQL-Datenmodellierung vs. RDBMS"
      - "Abfragen (where, orderBy, limit) und Transaktionen"
      - "Granulare Firestore Security Rules"
    tools:
      - "Cloud Firestore"
      - "Firebase Emulator"
  - moduleNumber: "05"
    title: "Build-Prozesse, Hosting & CI/CD"
    description: "Optimierung von Web-Assets, Single-Page-Application Routing und automatisiertes Deployment."
    topics:
      - "Vite Bundling und Minifizierung"
      - "Firebase Hosting Konfiguration (firebase.json)"
      - "Automatisiertes Deployment via GitHub Actions"
    tools:
      - "Firebase CLI"
      - "GitHub Actions"
---

