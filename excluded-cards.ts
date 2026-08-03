// Карты, снятые с игры контент-аудитом для РФ-релиза (см. CONTENT_AUDIT_RU.md
// в репо fosord, PR fosemberg/fosord#319). Их исходные PNG могут оставаться в
// IMAGES_PATH, но публиковаться и индексироваться они не должны.
//
// Единый источник списка для двух потребителей:
//   - convert-to-webp.ts — не конвертирует и не пускает их в images.json;
//   - cleanup-removed-cards.ts — вычищает уже опубликованные webp из docs/,
//     их ключи из images.json и сырые файлы из IMAGES_PATH.
// Снимаешь с игры ещё одну карту — просто дописывай id сюда и запускай
// `bun run cleanup`.
export const EXCLUDED_CARDS: ReadonlySet<string> = new Set([
  "dark_paladin", "martyr_saint", "exsanguination_saint", "vinci_apprentice",
  "flower_thrower", "hooded_vandal", "flagellant_prophet", "crusader",
  "high_exorcist", "graffiti_rat", "solar_flagellant", "transfusion_nun",
  "dismaland", "life_priest", "paladin", "quiet_inquisitor", "war_priest",
  "pink_elephant", "blessing_knight", "corrupted_paladin", "martyr_shieldbearer",
  "templar", "zeal_crusader", "archangel", "cathedral_gargoyle", "fallen_paladin",
  "inquisitor", "supreme_archangel", "ward_relic", "absolution_angel",
  "angel_of_death", "arch_angel_warrior", "chen", "fallen_angel", "omniknight",
  "seraph_warrior", "balloon_girl", "dark_priest", "guardian_angel",
  "halo_archer", "high_templar", "monkey_king", "monkey_clone", "redeemer_monk",
  "relic_bearer", "sacred_monk", "shredded_masterpiece", "the_pale_rider",
]);
