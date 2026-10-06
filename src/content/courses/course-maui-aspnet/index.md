---
title: "Mobile & Cloud Development"
description: "Course materials for cross-platform app development using .NET Multi-platform App UI (.NET MAUI) and ASP.NET Core cloud backend REST APIs."
repoName: "course-maui-aspnet"
learningGoals:
  - "Build cross-platform mobile & desktop graphical user interfaces with .NET MAUI."
  - "Design and implement secure, scalable REST APIs using ASP.NET Core."
  - "Integrate databases, repository patterns, and full-stack client-server communication."
terms:
  - "Summer Term 2024"
  - "Summer Term 2025"
language: "en"
screenshot:
  src: "./preview.jpg"
  title: "Mobile & Cloud: Full-Stack Client-Server Architecture"
  description: "Orthogonal schematic of a cross-platform mobile client connected to an ASP.NET Core cloud backend via bidirectional REST API endpoints"
tags:
  - "software-engineering"
  - "user-interface"
  - "teaching"
overview: "Modern application engineering requires delivering fluid multi-platform client applications backed by secure, scalable cloud services. This course covers end-to-end full-stack development using Microsoft's .NET ecosystem, pairing cross-platform native UIs (.NET MAUI) with container-ready REST APIs (ASP.NET Core)."
targetAudience: "Computer Science and Software Engineering students, as well as .NET developers aiming to expand into cross-platform native client and cloud backend architectures."
prerequisites:
  - "Solid proficiency in object-oriented programming in C#"
  - "Basic understanding of relational databases and SQL queries"
  - "Familiarity with HTTP networking and JSON data formats"
competencies:
  - title: "Cross-Platform Client Engineering"
    description: "Build adaptive mobile and desktop user interfaces with XAML, data binding, and MVVM."
    icon: "📱"
  - title: "Cloud REST API Architecture"
    description: "Design modular, testable HTTP backends using ASP.NET Core and dependency injection."
    icon: "☁️"
  - title: "Data Persistence & ORM"
    description: "Implement Entity Framework Core migrations, LINQ queries, and clean repository patterns."
    icon: "🗄️"
  - title: "Security & Client-Server Sync"
    description: "Secure endpoints with JWT authentication and implement resilient HTTP client communication."
    icon: "🔒"
syllabus:
  - moduleNumber: "01"
    title: ".NET MAUI Architecture & UI Layouts"
    description: "Multi-platform client lifecycle, XAML layouts, flex controls, and platform-specific adaptations."
    topics:
      - "Project Structure & Multi-Targeting"
      - "XAML Controls, Grid & Stack Layouts"
      - "Resource Dictionaries & Dark Mode Styling"
    tools:
      - ".NET MAUI"
      - "Visual Studio"
  - moduleNumber: "02"
    title: "MVVM Pattern & Data Binding"
    description: "Decoupling views from business logic with Model-View-ViewModel and reactive event bindings."
    topics:
      - "INotifyPropertyChanged & CommunityToolkit.Mvvm"
      - "Commanding & Value Converters"
      - "Navigation & Shell Architecture"
    tools:
      - "C#"
      - "CommunityToolkit.Mvvm"
  - moduleNumber: "03"
    title: "ASP.NET Core REST API Architecture"
    description: "Building production-grade web services with request pipelines and swagger specifications."
    topics:
      - "Controller vs. Minimal APIs"
      - "Dependency Injection & Middleware"
      - "OpenAPI / Swagger Documentation"
    tools:
      - "ASP.NET Core"
      - "Swagger"
  - moduleNumber: "04"
    title: "Data Persistence with Entity Framework Core"
    description: "Relational database modeling, migrations, and database access abstraction."
    topics:
      - "DbContext & Code-First Entity Modeling"
      - "Database Migrations & Seeding"
      - "Repository Pattern & Unit of Work"
    tools:
      - "EF Core"
      - "SQLite / SQL Server"
  - moduleNumber: "05"
    title: "Full-Stack Integration & Secure Authentication"
    description: "Connecting MAUI clients to backend APIs with authentication, token refresh, and error handling."
    topics:
      - "HttpClient & Resilient Networking"
      - "JWT Token Authentication & Role-Based Access"
      - "Offline Sync & Local Caching"
    tools:
      - "JWT"
      - "Postman"
---

