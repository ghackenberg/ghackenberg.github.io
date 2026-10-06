---
title: "Internet der Dinge"
description: "Unterlagen zu einem Kurs über das Internet der Dinge (IoT) inklusive Firmware in C# und Integration mit der IoT-Plattform Thingsboard."
repoName: "kurs-internet-der-dinge"
learningGoals:
  - "Entwicklung von Firmware für eingebettete Systeme und IoT-Edge-Devices."
  - "Verwendung von Netzwerkprotokollen wie MQTT und HTTP für die IoT-Telemetrie."
  - "Einrichtung und Visualisierung von Sensordaten in Dashboards auf der ThingsBoard-Plattform."
terms:
  - "Summer Term 2025"
language: "de"
screenshot:
  src: "./preview.jpg"
  title: "Internet der Dinge: Sensorik & Cloud-Telemetrie"
  description: "Orthogonale Schautafel eines Mikrocontroller-Boards mit Sensorik, Status-LEDs und gerichteten MQTT-Telemetriedatenströmen zu einem Cloud-Broker"
tags:
  - "iot"
  - "smart-home"
  - "industrial-informatics"
  - "teaching"
overview: "Das Internet der Dinge (IoT) verknüpft physische Sensorik und Aktorik mit modernen Cloud- und Edge-Architekturen. In diesem Kurs entwickeln Sie hardwarenahe Firmware in C# (.NET nanoFramework), übertragen Telemetriedaten sicher über MQTT und orchestrieren komplexe Datenströme und Dashboards auf der Open-Source-Plattform ThingsBoard."
targetAudience: "Studierende der Studiengänge Industrial Informatics, Mechatronik und Embedded Systems sowie IoT-Systementwickler."
prerequisites:
  - "Solide Grundkenntnisse in C# oder einer vergleichbaren objektorientierten Programmiersprache"
  - "Grundlegendes Verständnis von Rechnernetzen, IP-Adressierung und Ports"
  - "Elementare Elektronik- und Sensorikkenntnisse von Vorteil"
competencies:
  - title: "Embedded Firmware in C#"
    description: "Programmierung von Mikrocontrollern mit GPIO-, I2C- und SPI-Schnittstellen via .NET nanoFramework."
    icon: "📟"
  - title: "IoT-Telemetrieprotokolle"
    description: "Implementierung schlanker Publish/Subscribe-Kommunikation mit MQTT und TLS-Absicherung."
    icon: "📡"
  - title: "Edge-to-Cloud Integration"
    description: "Konfiguration von IoT-Gateways, Datentransformation und Cloud-Payload-Serialisierung."
    icon: "☁️"
  - title: "ThingsBoard & Rule Engines"
    description: "Erstellung interaktiver Überwachungsdashboards, Schwellwertalarme und Regelketten."
    icon: "📊"
syllabus:
  - moduleNumber: "01"
    title: "IoT-Architekturen & Hardware-Grundlagen"
    description: "Topologien von Sensor zu Cloud, Microcontroller-Hardware (ESP32) und Bussysteme (GPIO, I2C, SPI)."
    topics:
      - "IoT-Referenzarchitekturen (Edge, Gateway, Cloud)"
      - "ESP32 Pinout, Spannungsversorgung & Pegelwandlung"
      - "Digitale und analoge Sensorik (Temperatur, Feuchte, Druck)"
    tools:
      - "ESP32"
      - ".NET nanoFramework"
  - moduleNumber: "02"
    title: "Firmware-Entwicklung mit C#"
    description: "Setup des .NET nanoFrameworks, Task-Parallelisierung, Interrupts und energiesparende Deep-Sleep-Modi."
    topics:
      - "nanoFramework SDK & Visual Studio Extension"
      - "Hardware-Interrupts & Threading auf Mikrocontrollern"
      - "Stromsparmodi & Watchdog-Timer"
    tools:
      - "C#"
      - "Visual Studio"
  - moduleNumber: "03"
    title: "Netzwerkprotokolle & MQTT-Kommunikation"
    description: "WLAN-Verbindungsaufbau, MQTT-Broker-Topologie, Topics, Quality of Service (QoS) und JSON-Payloads."
    topics:
      - "MQTT Broker/Client-Architektur (Mosquitto)"
      - "QoS-Stufen (0, 1, 2) und Last-Will-and-Testament (LWT)"
      - "Kompakte JSON-Telemetrie & Serialisierung"
    tools:
      - "Mosquitto"
      - "MQTTX"
  - moduleNumber: "04"
    title: "ThingsBoard Plattform & Device Management"
    description: "Registrierung von Devices, Verwaltung von Access-Tokens, Attributen und Zeitseriendaten."
    topics:
      - "Device Profiles & Credential-Typen (Access Token, X.509)"
      - "Server- vs. Client-Attribute"
      - "Zeitserien-Telemetrie und Datenpartitionierung"
    tools:
      - "ThingsBoard CE"
      - "Docker"
  - moduleNumber: "05"
    title: "Rule Engine, Alarme & IoT-Dashboards"
    description: "Erstellung reaktiver Regelketten, Schwellwertüberwachung, Alarmgenerierung und Echtzeitvisualisierung."
    topics:
      - "ThingsBoard Rule Chain Knoten (Filter, Transform, Action)"
      - "Schwellwert-Trigger und automatische Alarmquittierung"
      - "Echtzeit-Widgets, Gauges und Steuerungs-Aktoren"
    tools:
      - "ThingsBoard Dashboards"
---

