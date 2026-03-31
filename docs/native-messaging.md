# Native Messaging

## Ziel

Thunderbird soll den nativen Kotlin-Host automatisch starten, damit kein separater manueller Start noetig ist.

## Bausteine

- Native-Host-Manifest
- Registrierung unter Windows
- Add-on mit `nativeMessaging`-Berechtigung
- Kotlin-Prozess mit Kommunikation ueber `stdin` und `stdout`

## Offene Punkte

- Exakter Host-Name
- Installationspfad unter Windows
- Verpackung des Kotlin-Hosts

