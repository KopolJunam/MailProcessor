# MailProcessor im Buero installieren

Diese Anleitung ist fuer einen Windows-Rechner gedacht, auf dem du das Repo lokal in IntelliJ hast und Thunderbird bereits installiert ist.

## Voraussetzungen

- Thunderbird ist installiert.
- Java ist installiert und `java` funktioniert in `cmd` oder PowerShell.
- Node.js + npm sind installiert.
- Das Laufwerk bzw. der Pfad fuer die Datenbank ist verfuegbar:
  - aktuell verwendet das Backend standardmaessig `N:\Privat\Administrativ\MailProcessor`
- Das Repo liegt lokal vor, z. B. unter `C:\Projekte\MailProcessor`

## 1. Repository in IntelliJ oeffnen

Projekt lokal auschecken oder kopieren und in IntelliJ oeffnen.

## 2. Backend bauen

In einer PowerShell im Projektordner:

```powershell
cd C:\Projekte\MailProcessor\backend
.\gradlew.bat installDist
```

Ergebnis:

- Der Native Host liegt danach unter:
  - `C:\Projekte\MailProcessor\backend\build\install\mailprocessor-backend`

## 3. Add-on paketieren

In einer zweiten PowerShell:

```powershell
cd C:\Projekte\MailProcessor\addon
npm.cmd install
npm.cmd run package
```

Ergebnis:

- Die XPI liegt danach unter:
  - `C:\Projekte\MailProcessor\addon\build\MailProcessor-0.1.8.xpi`

## 4. Native Host unter Windows registrieren

Zurueck im Projektwurzelverzeichnis:

```powershell
cd C:\Projekte\MailProcessor
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Register-NativeHost.ps1
```

Dadurch passiert Folgendes:

- Es wird eine Manifest-Datei erzeugt unter:
  - `C:\Projekte\MailProcessor\.native-host\mailprocessor.host.json`
- Es wird ein Registry-Eintrag gesetzt unter:
  - `HKCU\Software\Mozilla\NativeMessagingHosts\mailprocessor.host`

## 5. Installation pruefen

```powershell
cd C:\Projekte\MailProcessor
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Test-LocalInstall.ps1
```

Es sollten alle Checks mit `OK` durchlaufen.

## 6. Add-on in Thunderbird installieren

In Thunderbird:

1. `Add-ons und Themes` oeffnen
2. Zahnrad-Menue
3. `Add-on aus Datei installieren...`
4. Diese Datei waehlen:

`C:\Projekte\MailProcessor\addon\build\MailProcessor-0.1.8.xpi`

Danach Thunderbird neu starten.

## 7. Funktionstest

Nach dem Neustart:

1. Thunderbird oeffnen
2. Eine Mail in `_Reprocess` legen oder eine neue Testmail empfangen
3. Den MailProcessor-Button anklicken, um einen manuellen Sweep auszufuehren

Wenn alles korrekt installiert ist, sollte die Mail klassifiziert und verschoben werden.

## Typische Fehler

## Add-on tut gar nichts

Pruefen:

- Wurde wirklich `MailProcessor-0.1.8.xpi` installiert?
- Wurde Thunderbird nach der Installation neu gestartet?
- Lief `Test-LocalInstall.ps1` komplett mit `OK`?

## Native Host wird nicht gefunden

Pruefen:

- `Register-NativeHost.ps1` wurde ausgefuehrt
- Registry-Key existiert:
  - `HKCU\Software\Mozilla\NativeMessagingHosts\mailprocessor.host`
- Datei existiert:
  - `C:\Projekte\MailProcessor\.native-host\mailprocessor.host.json`

## Java fehlt

Wenn das Backend nicht startet, pruefen:

```powershell
java -version
```

Wenn das fehlschlaegt, Java installieren oder `JAVA_HOME` korrekt setzen.

## Datenbankpfad fehlt

Das Backend verwendet standardmaessig:

`N:\Privat\Administrativ\MailProcessor`

Wenn dieses Laufwerk im Buero nicht vorhanden ist, muss entweder:

- das Laufwerk verfuegbar sein

oder

- der Backend-Start spaeter auf einen anderen Datenbankpfad umgestellt werden

## Alles in einem Schritt

Wenn alle Voraussetzungen vorhanden sind, kannst du auch direkt das Gesamtskript verwenden:

```powershell
cd C:\Projekte\MailProcessor
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Install-Local.ps1
```

Danach nur noch die erzeugte XPI in Thunderbird installieren.
