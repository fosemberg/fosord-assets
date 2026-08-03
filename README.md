# fosord-assets

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

This project was created using `bun init` in bun v1.3.13. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Подчистка снятых с игры карт

Список удалённых контент-аудитом карт живёт в `excluded-cards.ts` — он общий
для конвертера (`bun run start` их не публикует) и для чистилки:

```bash
bun run cleanup                    # docs/ + images.json + сырые из IMAGES_PATH
bun run cleanup --dry-run          # только показать, ничего не трогать
bun run cleanup --delete           # сырые удалить насовсем (по умолчанию — карантин)
bun run cleanup --docs-only        # только публикация
bun run cleanup --raw-only         # только сырые
bun run cleanup /path/to/raws      # явный путь к сырым вместо IMAGES_PATH
```

Сырые PNG — оригиналы генераций (git их не хранит), поэтому по умолчанию они
не удаляются, а переезжают в карантин `<raw>/_removed/`; конвертер в подпапки
не заглядывает. Снял с игры ещё одну карту — допиши id в `excluded-cards.ts`
и прогони `bun run cleanup`.
