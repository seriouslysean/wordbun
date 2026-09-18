# Wordnik fixtures

Constructed, not recorded: no response here was captured from the live API. Each file is the body of a `GET /word.json/{word}/definitions` response, built from the `Definition`, `ExampleUsage`, `Related` and `TextPron` models in Wordnik's published OpenAPI spec (<https://developer.wordnik.com/api-docs/swagger.json>), plus `wordnikUrl`, which the adapter reads but the spec does not list.

- `amblypygi.json`: the part of speech, text, attribution, source dictionary and URL of the stored demo record `data/demo/words/2023/20230106.json`, with the empty lists the spec's list fields allow.
- `break.json`: invented text. It carries `textProns` and `relatedWords` objects, an example, text split into fragments (the adapter's `WordnikDefinition` type allows an array; the spec types `text` as a string), and two part-of-speech values from the spec's `partOfSpeech` enum that the adapter does not map, `verb-transitive` and `idiom`, which become labels.

Replace a file with a recorded response when one is available.
