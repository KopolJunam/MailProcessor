# MailProcessor

Monorepo fuer ein Thunderbird-Add-on und einen Kotlin-basierten Native-Messaging-Host.

## Struktur

- `backend/`: Kotlin/Gradle-Projekt fuer den nativen Host
- `addon/`: Thunderbird MailExtension mit kleinem TypeScript-Setup
- `docs/`: Architektur, Native Messaging und Protokoll

## Status

Das Repository enthaelt aktuell nur ein minimales Geruest. Die fachliche Implementierung folgt spaeter.

## Lokaler Entwicklungsablauf

Backend bauen und testen:

```powershell
cd backend
.\gradlew.bat test
.\gradlew.bat installDist
```

Add-on bauen:

```powershell
cd addon
npm.cmd install
npm.cmd run build
```

Native Host unter Windows registrieren:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Register-NativeHost.ps1
```
