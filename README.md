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
npm.cmd run package
```

Native Host unter Windows registrieren:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Register-NativeHost.ps1
```

Lokalen Installationsablauf fuer Thunderbird vorbereiten:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Install-Local.ps1
```

Der Ablauf paketiert das Add-on als `.xpi`, baut den nativen Host und registriert ihn unter Windows. Anschliessend kann die erzeugte `.xpi` in Thunderbird ueber "Install Add-on From File..." installiert werden.

Installation verifizieren:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Test-LocalInstall.ps1
```

Lokale Native-Host-Registrierung entfernen:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Uninstall-Local.ps1
```
