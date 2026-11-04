# Adjustable Bed Entity Card

Die generische Lovelace-Card gehört zur Integration **Adjustable Bed Entity Bridge**.

Sie erkennt automatisch alle Cover-Entitäten des in der Kartenkonfiguration ausgewählten Betts. Es müssen keine Entity-IDs manuell eingetragen werden.

## Ressource hinzufügen

In Home Assistant unter **Einstellungen → Dashboards → Ressourcen**:

```text
/local/adjustable_bed_entity/adjustable-bed-entity-card.js
```

Typ: **JavaScript Module**

Alternativ in `ui-lovelace.yaml`:

```yaml
resources:
  - url: /local/adjustable_bed_entity/adjustable-bed-entity-card.js
    type: module
```

## Karte verwenden

```yaml
type: custom:adjustable-bed-entity-card
device: DEINE_BETT_DEVICE_ID
```

Alternativ über den Gerätenamen:

```yaml
type: custom:adjustable-bed-entity-card
device_name: Verstellbares Bett
```

Optionaler Titel:

```yaml
type: custom:adjustable-bed-entity-card
device: DEINE_BETT_DEVICE_ID
title: Schlafzimmerbett
```

## Funktionen

- Automatische Erkennung von Kopf- und Fußteil-Cover
- Bett-Grafik mit beweglichem Kopf- und Fußteil
- Live-Anzeige von Prozentposition und Winkel
- Kopfteil hoch/runter mit Halten-Steuerung
- Fußteil hoch/runter mit Halten-Steuerung
- Stop pro Bettteil
- Alles stoppen
- Zielposition per Slider über `set_cover_position`
- Unterstützung für eine oder zwei Bettseiten

Die Karte benötigt keine Bluetooth-Entitäten und keine festen Entity-Namen.