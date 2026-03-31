# Protokoll

## Erste Request-Idee

```json
{
  "type": "classify-mail",
  "requestId": "123",
  "from": "sender@example.invalid"
}
```

## Erste Response-Idee

```json
{
  "type": "classification-result",
  "requestId": "123",
  "applyTag": true,
  "tagKey": "important-sender"
}
```

## Hinweis

Fachlich ist das JSON-basiert. Fuer Thunderbird Native Messaging kommt technisch noch das Langenpraefix des Protokolls dazu.
