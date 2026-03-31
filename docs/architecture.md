# Architektur

## Komponenten

- Thunderbird MailExtension in `addon/`
- Kotlin Native-Messaging-Host in `backend/`
- Gemeinsames JSON-Protokoll zwischen beiden Teilen

## Grundfluss

1. Das Add-on erkennt neue Mails.
2. Das Add-on sendet Absenderdaten an den nativen Host.
3. Der Host entscheidet ueber Tagging.
4. Das Add-on setzt den Tag in Thunderbird.

