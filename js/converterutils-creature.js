"use strict";

class AcConvert {
	static tryPostProcessAc (m, cbMan, cbErr) {
		let nuAc = [];
		const basic = /^(\d+)( \((.*?)\))?$/.exec(m.ac.trim());
		const basicAlt = /^(\d+)( (.*?))?$/.exec(m.ac.trim());
		if (basic || basicAlt) {
			if ((basic && basic[3]) || (basicAlt && basicAlt[3])) {
				const toUse = basic || basicAlt;
				const brak = toUse[3];
				let cur = {ac: Number(toUse[1])};

				let nextPart = null;

				const from = [];

				const splitter = StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX;

				const parts = brak.split(splitter).map(it => it.trim());

				parts.forEach(p => {
					const pLow = p.toLowerCase().replace(/^\(|\)$/g, "");
					switch (pLow) {
						// unhandled/other
						case "unarmored defense":
						case "suave defense":
						case "armor scraps":
						case "barding scraps":
						case "patchwork armor":
						case "see natural armor feature":
						case "barkskin trait":
						case "sylvan warrior":
						case "cage":
						case "chains":
						case "coin mail":
						case "crude armored coat":
						case "improvised armor":
						case "magic robes":
						case "makeshift armor":
						case "natural and mystic armor":
						case "padded armor":
						case "padded leather":
						case "parrying dagger":
						case "plant fiber armor":
						case "plus armor worn":
						case "rag armor":
						case "ring of protection +2":
						case "see below":
						case "wicker armor":
						case "bone armor":
							from.push(p);
							break;

						// au naturel
						case "natural armor":
						case "natural armour":
						case "natural":
							from.push("natural armor");
							break;

						// spells
						case "foresight bonus": from.push(`{@spell foresight} bonus`); break;
						case "natural barkskin": from.push(`natural {@spell barkskin}`); break;
						case "mage armor": from.push("{@spell mage armor}"); break;

						// armour (mostly handled by the item lookup; these are mis-named exceptions (usually for homebrew))
						case "chainmail":
						case "chain armor":
							from.push("{@item chain mail|phb}");
							break;

						case "plate mail":
						case "platemail":
						case "full plate":
							from.push("{@item plate armor|phb}");
							break;

						case "scale armor": from.push("{@item scale mail|phb}"); break;
						case "chain shirt": from.push("{@item chain shirt|phb}"); break;
						case "shields": from.push("{@item shield|phb|shields}"); break;

						// magic items
						case "dwarven plate": from.push("{@item dwarven plate}"); break;
						case "elven chain": from.push("{@item elven chain}"); break;
						case "glamoured studded leather": from.push("{@item glamoured studded leather}"); break;
						case "bracers of defense": from.push("{@item bracers of defense}"); break;
						case "badge of the watch": from.push("{@item Badge of the Watch|wdh}"); break;
						case "ring of protection": from.push("{@item ring of protection}"); break;
						case "robe of the archmagi": from.push("{@item robe of the archmagi}"); break;
						case "staff of power": from.push("{@item staff of power}"); break;

						// everything else
						default: {
							if (AcConvert._ITEM_LOOKUP[pLow]) {
								const itemMeta = AcConvert._ITEM_LOOKUP[pLow];

								if (itemMeta.isExact) from.push(`{@item ${pLow}${itemMeta.source === SRC_DMG ? "" : `|${itemMeta.source}`}}`);
								else from.push(`{@item ${itemMeta.name}${itemMeta.source === SRC_DMG ? "|" : `|${itemMeta.source}`}|${pLow}}`);
							} else if (pLow.endsWith("with mage armor") || pLow.endsWith("with barkskin")) {
								const numMatch = /(\d+) with (.*)/.exec(pLow);
								if (!numMatch) throw new Error("Spell AC but no leading number?");

								let spell = null;
								if (numMatch[2] === "mage armor") spell = `{@spell mage armor}`;
								else if (numMatch[2] === "barkskin") spell = `{@spell barkskin}`;
								else throw new Error(`Unhandled spell! ${numMatch[2]}`);

								nextPart = {
									ac: Number(numMatch[1]),
									condition: `with ${spell}`,
									braces: true
								}
							} else {
								if (cbMan) cbMan(p, `AC requires manual checking: ${m.name} ${m.source} p${m.page}`);
								nuAc.push(p)
							}
						}
					}
				});

				if (from.length) {
					cur.from = from;
					nuAc.push(cur);
				} else {
					nuAc.push(cur.ac);
				}
				if (nextPart) nuAc.push(nextPart)
			} else if (basic) {
				nuAc.push(Number(basic[1]));
			} else {
				if (cbErr) cbErr(m.ac, `${`${m.name} ${m.source} p${m.page}`.padEnd(48)} => ${m.ac}`);
				nuAc.push(m.ac);
			}
		} else {
			if (cbErr) cbErr(m.ac, `${`${m.name} ${m.source} p${m.page}`.padEnd(48)} => ${m.ac}`);
			nuAc.push(m.ac);
		}
		m.ac = nuAc;
	}

	static init (items) {
		const handlePlusName = (item, lowName) => {
			const mBonus = /^(.+) (\+\d+)$/.exec(lowName);
			if (mBonus) {
				const plusFirstName = `${mBonus[2]} ${mBonus[1]}`;
				AcConvert._ITEM_LOOKUP[plusFirstName] = {source: item.source, name: lowName};
			}
		};

		AcConvert._ITEM_LOOKUP = {};
		items
			.filter(it => it.type === "HA" || it.type === "MA" || it.type === "LA" || it.type === "S")
			.forEach(it => {
				const lowName = it.name.toLowerCase();
				AcConvert._ITEM_LOOKUP[lowName] = {source: it.source, isExact: true};

				const noArmorName = lowName.replace(/(^|\s)(?:armor|mail)(\s|$)/g, "$1$2").trim().replace(/\s+/g, " ");
				if (noArmorName !== lowName) {
					AcConvert._ITEM_LOOKUP[noArmorName] = {source: it.source, name: lowName};
				}

				handlePlusName(it, lowName);
				handlePlusName(it, noArmorName);
			});
	}
}
AcConvert._ITEM_LOOKUP = null;

class TagAttack {
	static tryTagAttacks (m, cbMan) {
		const handleProp = (prop) => {
			if (m[prop]) {
				m[prop].forEach(it => {
					if (it.entries) {
						const str = JSON.stringify(it.entries, null, "\t");
						const out = str.replace(/([\t ]")((?:(?:[A-Z][a-z]*|or) )*Attack:) /g, (...m) => {
							const lower = m[2].toLowerCase();
							if (TagAttack.MAP[lower]) {
								return `${m[1]}${TagAttack.MAP[lower]} `;
							} else {
								if (cbMan) cbMan(m[2]);
								return m[0];
							}
						});
						it.entries = JSON.parse(out);
					}
				})
			}
		};

		handleProp("action");
		handleProp("reaction");
		handleProp("trait");
		handleProp("legendary");
		handleProp("mythic");
		handleProp("variant");
	}
}
TagAttack.MAP = {
	"melee weapon attack:": "{@atk mw}",
	"ranged weapon attack:": "{@atk rw}",
	"melee attack:": "{@atk m}",
	"ranged attack:": "{@atk r}",
	"area attack:": "{@atk a}",
	"area weapon attack:": "{@atk aw}",
	"melee spell attack:": "{@atk ms}",
	"melee or ranged weapon attack:": "{@atk mw,rw}",
	"ranged spell attack:": "{@atk rs}",
	"melee or ranged spell attack:": "{@atk ms,rs}",
	"melee or ranged attack:": "{@atk m,r}"
};

class TagHit {
	static tryTagHits (m) {
		const handleProp = (prop) => {
			if (m[prop]) {
				m[prop].forEach(it => {
					if (it.entries) {
						const str = JSON.stringify(it.entries, null, "\t");
						const out = str.replace(/Hit: /g, "{@h}");
						it.entries = JSON.parse(out);
					}
				})
			}
		};

		handleProp("action");
		handleProp("reaction");
		handleProp("trait");
		handleProp("legendary");
		handleProp("mythic");
		handleProp("variant");
	}
}

class TagDc {
	static tryTagDcs (m) {
		const handleProp = (prop) => {
			if (m[prop]) {
				m[prop] = m[prop].map(it => {
					const str = JSON.stringify(it, null, "\t");
					const out = str.replace(/DC (\d+)/g, "{@dc $1}");
					return JSON.parse(out);
				})
			}
		};

		handleProp("action");
		handleProp("reaction");
		handleProp("trait");
		handleProp("legendary");
		handleProp("mythic");
		handleProp("variant");
		handleProp("spellcasting");
	}
}

class AlignmentConvert {
	static tryConvertAlignment (m, cbMan) {
		const orParts = (m.alignment || "").split(/ or /g).map(it => it.trim().replace(/[.,;]$/g, "").trim());
		const out = [];

		orParts.forEach(part => {
			Object.values(AlignmentConvert.ALIGNMENTS).forEach(it => {
				if (it.regex.test(part)) out.push(it.output);
				else {
					const mChange = it.regexChance.exec(part);
					if (mChange) {
						out.push({alignment: it.output, chance: Number(mChange[1])})
					}
				}
			})
		});

		if (out.length === 1) m.alignment = out[0];
		else if (out.length) m.alignment = out;
		else if (cbMan) cbMan(m.alignment);
	}
}
AlignmentConvert.ALIGNMENTS = {
	"lawful good": ["L", "G"],
	"neutral good": ["N", "G"],
	"chaotic good": ["C", "G"],
	"chaotic neutral": ["C", "N"],
	"lawful evil": ["L", "E"],
	"lawful neutral": ["L", "N"],
	"neutral evil": ["N", "E"],
	"chaotic evil": ["C", "E"],

	"good": ["G"],
	"lawful": ["L"],
	"neutral": ["N"],
	"chaotic": ["C"],
	"evil": ["E"],

	"unaligned": ["U"],

	"any alignment": ["A"],

	"any non-good( alignment)?": ["L", "NX", "C", "NY", "E"],
	"any non-lawful( alignment)?": ["NX", "C", "G", "NY", "E"],
	"any non-evil( alignment)?": ["L", "NX", "C", "NY", "G"],
	"any non-chaotic( alignment)?": ["NX", "L", "G", "NY", "E"],

	"any chaotic( alignment)?": ["C", "G", "NY", "E"],
	"any evil( alignment)?": ["L", "NX", "C", "E"],
	"any lawful( alignment)?": ["L", "G", "NY", "E"],
	"any good( alignment)?": ["L", "NX", "C", "G"],

	"any neutral( alignment)?": ["NX", "NY", "N"]
};
Object.entries(AlignmentConvert.ALIGNMENTS).forEach(([k, v]) => {
	AlignmentConvert.ALIGNMENTS[k] = {
		output: v,
		regex: RegExp(`^${k}$`),
		regexChance: RegExp(`^${k}\\s*\\((\\d+)\\s*%\\)$`)
	}
});

class TraitActionTag {
	static tryRun (m, cbMan) {
		function doTag (prop, outProp) {
			function isTraits () {
				return prop === "trait";
			}

			if (m[prop]) {
				m[prop].forEach(t => {
					if (!t.name) return;
					t.name = t.name.trim();

					const cleanName = t.name.toLowerCase();
					const mapped = TraitActionTag.tags[prop][cleanName];
					if (mapped) {
						if (mapped === true) m[outProp].add(t.name);
						else m[outProp].add(mapped)
					} else if (isTraits() && cleanName.startsWith("keen ")) {
						m[outProp].add("Keen Senses");
					} else if (isTraits() && cleanName.startsWith("legendary resistance")) {
						m[outProp].add("Legendary Resistances");
					} else if (isTraits() && cleanName.endsWith(" absorption")) {
						m[outProp].add("Damage Absorption");
					} else {
						if (cbMan) cbMan(prop, outProp, cleanName);
					}
				})
			}
		}

		function doTagDeep (prop, outProp) {
			if (!TraitActionTag.tagsDeep[prop]) return;

			if (m[prop]) {
				m[prop].forEach(t => {
					if (!t.entries) return;
					const strEntries = JSON.stringify(t.entries);

					Object.entries(TraitActionTag.tagsDeep[prop])
						.forEach(([tagName, fnShouldTag]) => {
							if (fnShouldTag(strEntries)) m[outProp].add(tagName);
						});
				})
			}
		}

		m.traitTags = new Set();
		m.actionTags = new Set();

		doTag("trait", "traitTags");
		doTag("action", "actionTags");
		doTag("reaction", "actionTags");

		doTagDeep("action", "actionTags");

		if (!m.traitTags.size) delete m.traitTags;
		else m.traitTags = [...m.traitTags];

		if (!m.actionTags.size) delete m.actionTags;
		else m.actionTags = [...m.actionTags];
	}
}
TraitActionTag.tags = { // true = map directly; string = map to this string
	trait: {
		"turn immunity": true,
		"brute": true,
		"antimagic susceptibility": true,
		"sneak attack": true,
		"sneak attack (1/turn)": "Sneak Attack",
		"reckless": true,
		"web sense": true,
		"flyby": true,
		"pounce": true,
		"water breathing": true,

		"turn resistance": true,
		"turn defiance": "Turn Resistance",
		"turning defiance": "Turn Resistance",
		"turn resistance aura": "Turn Resistance",
		"undead fortitude": true,

		"aggressive": true,
		"illumination": true,
		"rampage": true,
		"rejuvenation": true,
		"web walker": true,
		"incorporeal movement": true,

		"keen hearing and smell": "Keen Senses",
		"keen sight and smell": "Keen Senses",
		"keen hearing and sight": "Keen Senses",
		"keen hearing": "Keen Senses",
		"keen smell": "Keen Senses",
		"keen senses": true,

		"hold breath": true,

		"charge": true,

		"fey ancestry": true,

		"siege monster": true,

		"pack tactics": true,

		"regeneration": true,

		"shapechanger": true,

		"false appearance": true,
		"false appearance (object form only)": "False Appearance",

		"spider climb": true,

		"sunlight sensitivity": true,
		"sunlight hypersensitivity": "Sunlight Sensitivity",
		"light sensitivity": true,

		"amphibious": true,

		"legendary resistance (1/day)": "Legendary Resistances",
		"legendary resistance (2/day)": "Legendary Resistances",
		"legendary resistance (3/day)": "Legendary Resistances",
		"legendary resistance (5/day)": "Legendary Resistances",

		"magic weapon": "Magic Weapons",
		"magic weapons": true,

		"magic resistance": true,
		"spell immunity": "Magic Resistance",

		"ambush": "Ambusher",
		"ambusher": true,

		"amorphous": true,
		"amorphous form": "Amorphous",

		"death burst": true,
		"death throes": "Death Burst",

		"devil's sight": true,
		"devil sight": "Devil's Sight",

		"immutable form": true
	},
	action: {
		"multiattack": true,
		"frightful presence": true,
		"teleport": true,
		"swallow": true,
		"tentacle": "Tentacles",
		"tentacles": true
	},
	reaction: {
		"parry": true
	},
	legendary: {
		// unused
	},
	mythic: {
		// unused
	}
};
TraitActionTag.tagsDeep = {
	action: {
		"Swallow": strEntries => /swallowed/i.test(strEntries)
	}
};

class LanguageTag {
	/**
	 * @param m A creature statblock.
	 * @param [opt] Options object.
	 * @param [opt.cbAll] Callback to run on every parsed language.
	 * @param [opt.cbTracked] Callback to run on every tracked language.
	 * @param [opt.isAppendOnly] If tags should only be added, not removed.
	 */
	static tryRun (m, opt) {
		opt = opt || {};

		const tags = new Set();

		if (m.languages) {
			m.languages = m.languages.map(it => it.trim()).filter(it => !TagUtil.isNoneOrEmpty(it));
			if (!m.languages.length) {
				delete m.languages;
				return;
			} else {
				m.languages = m.languages.map(it => it.replace(/but can(not|'t) speak/ig, "but can't speak"));
			}

			m.languages.forEach(l => {
				if (opt.cbAll) opt.cbAll(l);

				Object.keys(LanguageTag.LANGUAGE_MAP).forEach(k => {
					const v = LanguageTag.LANGUAGE_MAP[k];

					const re = new RegExp(`(^|[^-a-zA-Z])${k}([^-a-zA-Z]|$)`, "g");

					if (re.exec(l)) {
						if ((v === "XX" || v === "X") && (l.includes("knew in life") || l.includes("spoke in life"))) return;
						if (v !== "CS" && /(one|the) languages? of its creator/i.exec(l)) return;

						if (opt.cbTracked) opt.cbTracked(v);
						tags.add(v);
					}
				})
			});
		}

		if (tags.size) {
			if (!opt.isAppendOnly) m.languageTags = [...tags];
			else {
				(m.languageTags || []).forEach(t => tags.add(t));
				m.languageTags = [...tags];
			}
		} else if (!opt.isAppendOnly) delete m.languageTags;
	}
}
LanguageTag.LANGUAGE_MAP = {
	"Abyssal": "AB",
	"Aquan": "AQ",
	"Auran": "AU",
	"Celestial": "CE",
	"Common": "C",
	"can't speak": "CS",
	"Draconic": "DR",
	"Dwarvish": "D",
	"Elvish": "E",
	"Giant": "GI",
	"Gnomish": "G",
	"Goblin": "GO",
	"Halfling": "H",
	"Infernal": "I",
	"Orc": "O",
	"Primordial": "P",
	"Sylvan": "S",
	"Terran": "T",
	"Undercommon": "U",
	"Aarakocra": "OTH",
	"one additional": "X",
	"Blink Dog": "OTH",
	"Bothii": "OTH",
	"Bullywug": "OTH",
	"one other language": "X",
	"plus six more": "X",
	"plus two more languages": "X",
	"up to five other languages": "X",
	"Druidic": "DU",
	"Giant Eagle": "OTH",
	"Giant Elk": "OTH",
	"Giant Owl": "OTH",
	"Gith": "GTH",
	"Grell": "OTH",
	"Grung": "OTH",
	"Homarid": "OTH",
	"Hook Horror": "OTH",
	"Ice Toad": "OTH",
	"Ixitxachitl": "OTH",
	"Kruthik": "OTH",
	"Netherese": "OTH",
	"Olman": "OTH",
	"Otyugh": "OTH",
	"Primal": "OTH",
	"Sahuagin": "OTH",
	"Sphinx": "OTH",
	"Thayan": "OTH",
	"Thri-kreen": "OTH",
	"Tlincalli": "OTH",
	"Troglodyte": "OTH",
	"Umber Hulk": "OTH",
	"Vegepygmy": "OTH",
	"Winter Wolf": "OTH",
	"Worg": "OTH",
	"Yeti": "OTH",
	"Yikaria": "OTH",
	"all": "XX",
	"all but rarely speaks": "XX",
	"any one language": "X",
	"any two languages": "X",
	"any three languages": "X",
	"any four languages": "X",
	"any five languages": "X",
	"any six languages": "X",
	"one language of its creator's choice": "X",
	"two other languages": "X",
	"telepathy": "TP",
	"thieves' cant": "TC",
	"Thieves' cant": "TC",
	"Deep Speech": "DS",
	"Gnoll": "OTH",
	"Ignan": "IG",
	"Modron": "OTH",
	"Slaad": "OTH",
	"all languages": "XX",
	"any language": "X",
	"knew in life": "LF",
	"spoke in life": "LF"
};

class SenseFilterTag {
	static tryRun (m, cbAll) {
		if (m.senses) {
			m.senses = m.senses.filter(it => !TagUtil.isNoneOrEmpty(it));
			if (!m.senses.length) delete m.senses;
			else {
				const senseTags = new Set();
				m.senses.map(it => it.trim().toLowerCase())
					.forEach(s => {
						Object.entries(SenseFilterTag.TAGS).forEach(([k, v]) => {
							if (s.includes(k)) {
								if (v === "D" && /\d\d\d ft/.exec(s)) senseTags.add("SD");
								else senseTags.add(v);
							}
						});

						if (cbAll) cbAll(s);
					});

				if (senseTags.size === 0) delete m.senseTags;
				else m.senseTags = [...senseTags];
			}
		} else delete m.senseTags;
	}
}
SenseFilterTag.TAGS = {
	"blindsight": "B",
	"darkvision": "D",
	"tremorsense": "T",
	"truesight": "U"
};

class SpellcastingTypeTag {
	static tryRun (m, cbAll) {
		if (!m.spellcasting) {
			delete m.spellcastingTags;
		} else {
			const tags = new Set();
			m.spellcasting.forEach(sc => {
				if (!sc.name) return;
				if (/(^|[^a-zA-Z])psionics([^a-zA-Z]|$)/gi.exec(sc.name)) tags.add("P");
				if (/(^|[^a-zA-Z])innate([^a-zA-Z]|$)/gi.exec(sc.name)) tags.add("I");
				if (/(^|[^a-zA-Z])form([^a-zA-Z]|$)/gi.exec(sc.name)) tags.add("F");
				if (/(^|[^a-zA-Z])shared([^a-zA-Z]|$)/gi.exec(sc.name)) tags.add("S");

				if (sc.headerEntries) {
					const strHeader = JSON.stringify(sc.headerEntries);
					Object.entries(SpellcastingTypeTag.CLASSES).forEach(([tag, regex]) => {
						regex.lastIndex = 0;
						const match = regex.exec(strHeader);
						if (match) {
							tags.add(tag);
							if (cbAll) cbAll(match[0]);
						}
					});
				}

				if (cbAll) cbAll(sc.name);
			});
			if (tags.size) m.spellcastingTags = [...tags];
			else delete m.spellcastingTags;
		}
	}
}
SpellcastingTypeTag.CLASSES = {
	"CA": /(^|[^a-zA-Z])artificer([^a-zA-Z]|$)/gi,
	"CB": /(^|[^a-zA-Z])bard([^a-zA-Z]|$)/gi,
	"CC": /(^|[^a-zA-Z])cleric([^a-zA-Z]|$)/gi,
	"CD": /(^|[^a-zA-Z])druid([^a-zA-Z]|$)/gi,
	"CP": /(^|[^a-zA-Z])paladin([^a-zA-Z]|$)/gi,
	"CR": /(^|[^a-zA-Z])ranger([^a-zA-Z]|$)/gi,
	"CS": /(^|[^a-zA-Z])sorcerer([^a-zA-Z]|$)/gi,
	"CL": /(^|[^a-zA-Z])warlock([^a-zA-Z]|$)/gi,
	"CW": /(^|[^a-zA-Z])wizard([^a-zA-Z]|$)/gi
};

class DamageTypeTag {
	static _handleProp (m, prop, typeSet) {
		if (m[prop]) {
			m[prop].forEach(it => {
				if (it.entries) {
					const str = JSON.stringify(it.entries, null, "\t");

					str.replace(RollerUtil.REGEX_DAMAGE_DICE, (m0, average, prefix, diceExp, suffix) => {
						suffix.replace(ConverterConst.RE_DAMAGE_TYPE, (m0, type) => typeSet.add(DamageTypeTag._TYPE_LOOKUP[type]));
					});

					str.replace(DamageTypeTag._ONE_DAMAGE_REGEX, (m0, type) => {
						typeSet.add(DamageTypeTag._TYPE_LOOKUP[type]);
					});
				}
			})
		}
	}

	static tryRun (m) {
		if (!DamageTypeTag._isInit) {
			DamageTypeTag._isInit = true;
			Object.entries(Parser.DMGTYPE_JSON_TO_FULL).forEach(([k, v]) => DamageTypeTag._TYPE_LOOKUP[v] = k);
		}
		const typeSet = new Set();
		DamageTypeTag._handleProp(m, "action", typeSet);
		DamageTypeTag._handleProp(m, "reaction", typeSet);
		DamageTypeTag._handleProp(m, "trait", typeSet);
		DamageTypeTag._handleProp(m, "legendary", typeSet);
		DamageTypeTag._handleProp(m, "mythic", typeSet);
		DamageTypeTag._handleProp(m, "variant", typeSet);
		if (typeSet.size) m.damageTags = [...typeSet];
	}
}
DamageTypeTag._isInit = false;
DamageTypeTag._ONE_DAMAGE_REGEX = new RegExp(`1 ${ConverterConst.STR_RE_DAMAGE_TYPE} damage`, "gi");
DamageTypeTag._TYPE_LOOKUP = {};

class MiscTag {
	static _handleProp (m, prop, tagSet) {
		if (m[prop]) {
			m[prop].forEach(it => {
				let hasRangedAttack = false;
				if (it.entries) {
					const str = JSON.stringify(it.entries, null, "\t");

					// Weapon attacks
					// - any melee/ranged attack
					str.replace(/{@atk ([^}]+)}/g, (...mx) => {
						const spl = mx[1].split(",");
						if (spl.includes("rw")) {
							tagSet.add("RW");
							hasRangedAttack = true;
						}
						if (spl.includes("mw")) tagSet.add("MW");
					});

					// - reach
					str.replace(/reach (\d+) ft\./g, (...m) => {
						if (Number(m[1]) > 5) tagSet.add("RCH");
					});

					// AoE effects
					str.replace(/\d+-foot[- ](line|cube|cone|radius|sphere|hemisphere|cylinder)/g, () => tagSet.add("AOE"));
				}

				if (it.name) {
					// thrown weapon (PHB only)
					if (hasRangedAttack) MiscTag._THROWN_WEAPON_MATCHERS.forEach(r => it.name.replace(r, () => tagSet.add("THW")));
					// other ranged weapon (PHB only)
					MiscTag._RANGED_WEAPON_MATCHERS.forEach(r => it.name.replace(r, () => tagSet.add("RNG")));
				}
			})
		}
	}

	static tryRun (m) {
		const typeSet = new Set();
		MiscTag._handleProp(m, "action", typeSet);
		MiscTag._handleProp(m, "trait", typeSet);
		MiscTag._handleProp(m, "reaction", typeSet);
		MiscTag._handleProp(m, "legendary", typeSet);
		MiscTag._handleProp(m, "mythic", typeSet);
		if (typeSet.size) m.miscTags = [...typeSet];
		else delete m.miscTags;
	}
}
MiscTag._THROWN_WEAPONS = [
	"dagger",
	"handaxe",
	"javelin",
	"light hammer",
	"spear",
	"trident",
	"dart",
	"net"
];
MiscTag._THROWN_WEAPON_MATCHERS = MiscTag._THROWN_WEAPONS.map(it => new RegExp(`(^|[^\\w])(${it})([^\\w]|$)`, "gi"));
MiscTag._RANGED_WEAPONS = [
	"light crossbow",
	"shortbow",
	"sling",
	"blowgun",
	"hand crossbow",
	"heavy crossbow",
	"longbow"
];
MiscTag._RANGED_WEAPON_MATCHERS = MiscTag._RANGED_WEAPONS.map(it => new RegExp(`(^|[^\\w])(${it})([^\\w]|$)`, "gi"));

class SpellcastingTraitConvert {
	static init (spellData) {
		// reversed so official sources take precedence over 3pp
		spellData.forEach(s => SpellcastingTraitConvert.SPELL_SRC_MAP[s.name.toLowerCase()] = s.source)
	}

	static tryParseSpellcasting (trait, isMarkdown, cbErr) {
		let spellcasting = [];

		function parseSpellcasting (trait) {
			const splitter = StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX;

			function getParsedSpells (thisLine) {
				let spellPart = thisLine.substring(thisLine.indexOf(": ") + 2).trim();
				if (isMarkdown) {
					const cleanPart = (part) => {
						part = part.trim();
						while (part.startsWith("*") && part.endsWith("*")) {
							part = part.replace(/^\*(.*)\*$/, "$1");
						}
						return part;
					};

					const cleanedInner = spellPart.split(splitter).map(it => cleanPart(it)).filter(it => it);
					spellPart = cleanedInner.join(", ");

					while (spellPart.startsWith("*") && spellPart.endsWith("*")) {
						spellPart = spellPart.replace(/^\*(.*)\*$/, "$1");
					}
				}

				// move asterisks before commas (e.g. "chaos bolt,*" -> "chaos bolt*,")
				spellPart = spellPart.replace(/,\s*\*/g, "*,");

				return spellPart.split(splitter).map(i => parseSpell(i));
			}

			let name = trait.name;
			let spellcastingEntry = {"name": name, "headerEntries": [parseToHit(trait.entries[0])]};
			let doneHeader = false;
			trait.entries.forEach((thisLine, i) => {
				thisLine = thisLine.replace(/,\s*\*/g, ",*"); // put asterisks on the correct side of commas
				if (i === 0) return;
				if (thisLine.includes("/rest")) {
					doneHeader = true;
					let property = thisLine.substr(0, 1) + (thisLine.includes(" each:") ? "e" : "");
					const value = getParsedSpells(thisLine);
					if (!spellcastingEntry.rest) spellcastingEntry.rest = {};
					spellcastingEntry.rest[property] = value;
				} else if (thisLine.includes("/day")) {
					doneHeader = true;
					let property = thisLine.substr(0, 1) + (thisLine.includes(" each:") ? "e" : "");
					const value = getParsedSpells(thisLine);
					if (!spellcastingEntry.daily) spellcastingEntry.daily = {};
					spellcastingEntry.daily[property] = value;
				} else if (thisLine.includes("/week")) {
					doneHeader = true;
					let property = thisLine.substr(0, 1) + (thisLine.includes(" each:") ? "e" : "");
					const value = getParsedSpells(thisLine);
					if (!spellcastingEntry.weekly) spellcastingEntry.weekly = {};
					spellcastingEntry.weekly[property] = value;
				} else if (thisLine.startsWith("Constant: ")) {
					doneHeader = true;
					spellcastingEntry.constant = getParsedSpells(thisLine);
				} else if (thisLine.startsWith("At will: ")) {
					doneHeader = true;
					spellcastingEntry.will = getParsedSpells(thisLine);
				} else if (thisLine.includes("Cantrip")) {
					doneHeader = true;
					const value = getParsedSpells(thisLine);
					if (!spellcastingEntry.spells) spellcastingEntry.spells = {"0": {"spells": []}};
					spellcastingEntry.spells["0"].spells = value;
				} else if (thisLine.includes(" level") && thisLine.includes(": ")) {
					doneHeader = true;
					let property = thisLine.substr(0, 1);
					const allSpells = getParsedSpells(thisLine);
					spellcastingEntry.spells = spellcastingEntry.spells || {};

					const out = {};
					if (thisLine.includes(" slot")) {
						const mWarlock = /^(\d)..(?: level)?-(\d).. level \((\d) (\d)..-level slots?\)/.exec(thisLine);
						if (mWarlock) {
							out.lower = parseInt(mWarlock[1]);
							out.slots = parseInt(mWarlock[3]);
							property = mWarlock[4];
						} else {
							const mSlots = /\((\d) slots?\)/.exec(thisLine);
							if (!mSlots) throw new Error(`Could not find slot count!`);
							out.slots = parseInt(mSlots[1]);
						}
					}
					// add these last, to have nicer ordering
					out.spells = allSpells;

					spellcastingEntry.spells[property] = out;
				} else {
					if (doneHeader) {
						if (!spellcastingEntry.footerEntries) spellcastingEntry.footerEntries = [];
						spellcastingEntry.footerEntries.push(parseToHit(thisLine));
					} else {
						spellcastingEntry.headerEntries.push(parseToHit(thisLine));
					}
				}
			});

			SpellcastingTraitConvert.mutSpellcastingAbility(spellcastingEntry);

			spellcasting.push(spellcastingEntry);
		}

		function parseSpell (name) {
			function getSourcePart (spellName) {
				const source = SpellcastingTraitConvert._getSpellSource(spellName);
				return `${source && source !== SRC_PHB ? `|${source}` : ""}`;
			}

			name = name.trim();
			let asterix = name.indexOf("*");
			let brackets = name.indexOf(" (");
			if (asterix !== -1) {
				const trueName = name.substr(0, asterix);
				return `{@spell ${trueName}${getSourcePart(trueName)}}*`;
			} else if (brackets !== -1) {
				const trueName = name.substr(0, brackets);
				return `{@spell ${trueName}${getSourcePart(trueName)}}${name.substring(brackets)}`;
			}
			return `{@spell ${name}${getSourcePart(name)}}`;
		}

		function parseToHit (line) {
			return line.replace(/( \+)(\d+)( to hit with spell)/g, (m0, m1, m2, m3) => ` {@hit ${m2}}${m3}`);
		}

		try {
			parseSpellcasting(trait);
			return {out: spellcasting, success: true};
		} catch (e) {
			cbErr && cbErr(`Failed to parse spellcasting: ${e.message}`);
			return {out: trait, success: false};
		}
	}

	static mutSpellcastingAbility (spellcastingEntry) {
		if (spellcastingEntry.headerEntries) {
			const m = /strength|dexterity|constitution|charisma|intelligence|wisdom/gi.exec(JSON.stringify(spellcastingEntry.headerEntries));
			if (m) spellcastingEntry.ability = m[0].substring(0, 3).toLowerCase();
		}
	}

	static _getSpellSource (spellName) {
		if (spellName && SpellcastingTraitConvert.SPELL_SRC_MAP[spellName.toLowerCase()]) return SpellcastingTraitConvert.SPELL_SRC_MAP[spellName.toLowerCase()];
		return null;
	}
}
SpellcastingTraitConvert.SPELL_SRC_MAP = {};

class RechargeConvert {
	static tryConvertRecharge (traitOrAction, cbAll, cbMan) {
		if (traitOrAction.name) {
			traitOrAction.name = traitOrAction.name.replace(/\((Recharge )(\d.*?)\)$/gi, (...m) => {
				if (cbAll) cbAll(m[2]);
				const num = m[2][0];
				if (num === "6") return `{@recharge}`;
				if (isNaN(Number(num))) {
					if (cbMan) cbMan(traitOrAction.name);
					return m[0];
				}
				return `{@recharge ${num}}`;
			});
		}
	}
}

class SpeedConvert {
	static _splitSpeed (str) {
		let c;
		let ret = [];
		let stack = "";
		let para = 0;
		for (let i = 0; i < str.length; ++i) {
			c = str.charAt(i);
			switch (c) {
				case ",":
					if (para === 0) {
						ret.push(stack);
						stack = "";
					}
					break;
				case "(": para++; stack += c; break;
				case ")": para--; stack += c; break;
				default: stack += c;
			}
		}
		if (stack) ret.push(stack);
		return ret.map(it => it.trim()).filter(it => it);
	}

	static _tagHover (m) {
		if (m.speed && m.speed.fly && m.speed.fly.condition) {
			m.speed.fly.condition = m.speed.fly.condition.trim();

			if (m.speed.fly.condition.toLowerCase().includes("hover")) m.speed.canHover = true;
		}
	}

	static tryConvertSpeed (m, cbMan) {
		if (typeof m.speed === "string") {
			let line = m.speed.toLowerCase().trim().replace(/^speed:?\s*/, "");

			const out = {};
			let byHand = false;

			SpeedConvert._splitSpeed(line.toLowerCase()).map(it => it.trim()).forEach(s => {
				const m = /^(\w+?\s+)?(\d+)\s*ft\.?( .*)?$/.exec(s);
				if (!m) {
					byHand = true;
					return;
				}

				if (m[1]) m[1] = m[1].trim();
				else m[1] = "walk";

				if (SpeedConvert._SPEED_TYPES.has(m[1])) {
					if (m[3]) {
						out[m[1]] = {
							number: Number(m[2]),
							condition: m[3].trim()
						};
					} else out[m[1]] = Number(m[2]);
				} else byHand = true;
			});

			// flag speed as invalid
			if (Object.values(out).filter(s => (s.number != null ? s.number : s) % 5 !== 0).length) out.INVALID_SPEED = true;

			// flag speed as needing hand-parsing
			if (byHand) {
				out.UNPARSED_SPEED = line;
				if (cbMan) cbMan(`Speed requires manual conversion: "${line}"`);
			}

			m.speed = out;
			SpeedConvert._tagHover(m);
		}
	}
}
SpeedConvert._SPEED_TYPES = new Set(["walk", "fly", "swim", "climb", "burrow"]);

class DetectNamedCreature {
	static tryRun (mon) {
		const totals = {yes: 0, no: 0};
		this._doCheckProp(mon, totals, "action");
		this._doCheckProp(mon, totals, "reaction");
		this._doCheckProp(mon, totals, "legendary");
		this._doCheckProp(mon, totals, "mythic");

		if (totals.yes && totals.yes > totals.no) mon.isNamedCreature = true;
	}

	static _doCheckProp (mon, totals, prop) {
		if (!mon.name) return;
		if (mon.isNamedCreature) return;
		if (!mon[prop]) return;

		mon[prop].forEach(it => {
			if (!it.entries || !it.entries.length) return;
			if (typeof it.entries[0] !== "string") return;

			const namePart = mon.name.split(/[ ,:.!;]/g)[0] || "".trim();

			const isNotNamedCreature = new RegExp(`^The ${namePart}`).test(it.entries[0]);
			const isNamedCreature = new RegExp(`^${namePart}`).test(it.entries[0]);

			if (isNotNamedCreature && isNamedCreature) return;
			if (isNamedCreature) totals.yes++;
			if (isNotNamedCreature) totals.no++;
		});
	}
}

class TagImmResVulnConditional {
	static tryRun (mon) {
		this._handleProp(mon, "resist");
		this._handleProp(mon, "immune");
		this._handleProp(mon, "vulnerable");
	}

	static _handleProp (mon, prop) {
		if (!mon[prop]) return;
		mon[prop].forEach(it => this._handleProp_recurse(it, prop));
	}

	static _handleProp_recurse (obj, prop) {
		if (obj.note) {
			const note = obj.note.toLowerCase().trim().replace(/^\(/, "").replace(/^damage/, "").trim()
			if (
				note.startsWith("while ")
				|| note.startsWith("from ")
				|| note.startsWith("from ")
				|| note.startsWith("if ")
				|| note.startsWith("against ")
				|| note.startsWith("except ")
				|| note.startsWith("with ")
			) {
				obj.cond = true;
			}
		}

		if (obj[prop]) obj[prop].forEach(it => this._handleProp_recurse(it, prop));
	}
}

if (typeof module !== "undefined") {
	module.exports = {
		AcConvert,
		TagAttack,
		TagHit,
		TagDc,
		AlignmentConvert,
		TraitActionTag,
		LanguageTag,
		SenseFilterTag,
		SpellcastingTypeTag,
		DamageTypeTag,
		MiscTag,
		SpellcastingTraitConvert,
		RechargeConvert,
		DetectNamedCreature,
		TagImmResVulnConditional
	};
}
