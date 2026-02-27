"use client";

import { useMemo, useState } from "react";

const EMOJI_CATEGORIES = {
  faces: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😭 😤 😠 😡 🤬 😳 😱 😨 😰 😥 😓 🤗 🤔 😴 🤤 😪 🤒 🤕 🤠 🤡 💩 👻 💀 🎃".split(" "),
  people: "👩 👩‍🦰 👩‍🦱 👩‍🦳 👩‍🦲 👱‍♀️ 👵 👸 💃 🕺 👯‍♀️ 🧚‍♀️ 🧜‍♀️ 🦸‍♀️ 🧝‍♀️ 🙋‍♀️ 🙆‍♀️ 🙅‍♀️ 🤷‍♀️ 👩‍💻 👩‍🎤 👩‍🎨 👩‍🍳 👰‍♀️ 🤰 🤱".split(" "),
  animals: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐵 🦄 🦋 🐝 🐢 🐙 🐬 🐳 🦈 🐊 🐘 🦒 🦘 🐎 🐕 🐓 🦅 🦆 🦢 🦉 🦚 🦜 🐸".split(" "),
  plants: "🌹 🥀 🌺 🌻 🌼 🌷 🌱 🌲 🌳 🌴 🌵 🌿 🍀 🍁 🍄 🔥 ✨ ⭐ ☀️ 🌙 ☁️ 🌊 🌎".split(" "),
  food: "🍇 🍉 🍊 🍋 🍌 🍍 🍎 🍏 🍐 🍑 🍒 🍓 🥝 🍅 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🍞 🥐 🥖 🧀 🍖 🍔 🍟 🍕 🌮 🍣 🍤 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍬 ☕ 🍵 🍾 🍷 🍸 🍹 🍺 🍻 🥂".split(" "),
  sports: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🏒 ⛳ 🏹 🥊 🥋 ⛸️ 🎿 🏂 🏋️ 🤸 🏇 🏊 🏄 🎯 🎳 🎮 🎲 🧩 ♟️".split(" "),
  travel: "🎨 🎬 🎤 🎧 🎹 🥁 🎉 🎊 🎄 🎆 🚀 ✈️ 🚁 🛰️ ⛵ 🚢 🚗 🚕 🚌 🚓 🚑 🚒 🚚 🚂 🚲 🚦 🗽 🗼 🏰 🎡 🎢 🎪 ⛺ 🏠 🏡 🏢 🏨 🏦 🏥 🏫 🏛️ 🏝️ 🏞️ ⛰️".split(" "),
  objects: "💡 💻 🖥️ 🖱️ 📱 ☎️ 📺 📷 📹 🎥 💿 💾 💰 💵 💎 🔧 🔨 🛠️ 🔑 🚪 🪑 🛏️ 🛁 🚽 🎁 🎈 📚 📖 📄 📰 🔗 📎 ✂️ 🗑️ 🔒 🔓 🔔 👗 👠 👑 💍 💄 👛 👜".split(" "),
  symbols: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 💯 ✅ ❌ ❓ ❕ ©️ ®️ ™️".split(" "),
} as const;

const EMOJI_CATEGORY_ORDER = ["all", "faces", "people", "animals", "plants", "food", "sports", "travel", "objects", "symbols"] as const;
export type EmojiCategory = (typeof EMOJI_CATEGORY_ORDER)[number];

const EMOJI_CATEGORY_ICONS: Record<EmojiCategory, string> = {
  all: "😀",
  faces: "😀",
  people: "👩",
  animals: "🐶",
  plants: "🌹",
  food: "🍎",
  sports: "⚽",
  travel: "✈️",
  objects: "💡",
  symbols: "❤️",
};

export type AdminEmojiPickerProps = {
  onPick: (emoji: string) => void;
  onClose: () => void;
  query: string;
  setQuery: (v: string) => void;
};

export function AdminEmojiPicker({ onPick, onClose, query, setQuery }: AdminEmojiPickerProps) {
  const [category, setCategory] = useState<EmojiCategory>("all");
  const normalized = query.trim().toLowerCase();
  const visibleEmojis = useMemo(() => {
    const source =
      category === "all"
        ? EMOJI_CATEGORY_ORDER.filter((c) => c !== "all").flatMap((c) => EMOJI_CATEGORIES[c])
        : EMOJI_CATEGORIES[category];
    if (!normalized) return source;
    return source.filter((e) => e.includes(normalized));
  }, [category, normalized]);

  return (
    <div className="admin-emoji-picker-wrap" role="dialog" aria-label="Pick emoji">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search emoji..."
        className="admin-emoji-search"
      />
      <div className="admin-emoji-grid">
        {visibleEmojis.length === 0 ? (
          <p className="admin-emoji-empty">No emoji found.</p>
        ) : (
          visibleEmojis.map((e, i) => (
            <button
              key={`${category}-${i}-${e}`}
              type="button"
              className="admin-emoji-btn"
              onClick={() => {
                onPick(e);
                onClose();
              }}
              aria-label={`Emoji ${e}`}
            >
              {e}
            </button>
          ))
        )}
      </div>
      <div className="admin-emoji-category-bar" role="tablist" aria-label="Emoji categories">
        {EMOJI_CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            className={`admin-emoji-category-btn${category === c ? " active" : ""}`}
            onClick={() => setCategory(c)}
            aria-label={`Show ${c} emoji`}
            title={c}
          >
            {EMOJI_CATEGORY_ICONS[c]}
          </button>
        ))}
      </div>
    </div>
  );
}
