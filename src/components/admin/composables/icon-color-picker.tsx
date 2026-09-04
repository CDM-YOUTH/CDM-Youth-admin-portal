import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMOJI_CATEGORIES = {
  "Church & Faith": ["⛪", "✝️", "🙏", "📖", "🕯️", "🔔", "💒", "⚱️", "🙋", "🕊️"],
  "Mary, Mother of God": ["👑", "🤱", "👶", "💙", "🙏", "🕊️", "⭐", "🌹", "📿", "🕯️", "💝", "🌟", "🌙", "🩵", "💎", "🙋‍♀️"],
  "Marian Devotion": ["💒", "🕯️", "📿", "🌹", "💙", "🌸", "⛪", "🎀", "✨", "💝", "🫂", "🏵️", "🙏", "👑", "🕊️", "⭐"],
  "Rosary & Prayer": ["📿", "🔟", "🙏", "🕯️", "💫", "✨", "⭐", "🌹", "💚", "💛"],
  "Sacramentals": ["📿", "✝️", "🕯️", "💍", "🔔", "🙏", "💧", "🌿", "✨", "🥦"],
  "Eucharist & Mass": ["🕯️", "🍇", "🍷", "🥖", "🍞", "🔔", "💒", "👼", "✨", "⭐"],
  "Sacraments": ["💍", "🕯️", "🍇", "🍷", "💒", "👨‍⚖️", "👼", "💝", "🔔", "✝️"],
  "People & Community": ["👥", "👨‍👩‍👧‍👦", "👨‍🦱", "👩", "👦", "👶", "🤝", "💪", "🫂", "🧑‍🤝‍🧑"],
  "Activities & Learning": ["📚", "📖", "✍️", "🎓", "🧠", "💡", "🎯", "📝", "📋", "🗣️"],
  "Nature & Creation": ["🌍", "🌿", "🌱", "🌸", "🌞", "🌙", "⭐", "🦋", "🐦", "🌊"],
  "Love & Care": ["❤️", "💚", "💛", "💜", "🩷", "🩵", "🤍", "🥰", "😇", "🫶"],
  "Service & Help": ["🤝", "💼", "🏥", "🏫", "🏠", "🍽️", "🤲", "🧡", "⚕️", "📱"],
  "Celebration & Joy": ["🎉", "🎊", "🎈", "⭐", "🌟", "✨", "🎆", "🎇", "🥳", "😊"],
  "Virtues & Values": ["🦁", "🛡️", "🔑", "👑", "💎", "🏆", "🎖️", "⚡", "🔥", "💫"],
  "Symbols": ["✝️", "☦️", "🕎", "☪️", "🔯", "☯️", "🔱", "⚜️", "💒", "🕋"],
};

export function IconColorPicker({
  selectedIcon,
  selectedColor,
  onIconChange,
  onColorChange,
}: {
  selectedIcon: string;
  selectedColor: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Church & Faith");

  const filteredEmojis = Object.entries(EMOJI_CATEGORIES).reduce(
    (acc, [category, emojis]) => {
      const filtered = emojis.filter((emoji) => {
        const name = Object.entries(EMOJI_CATEGORIES)
          .find(([_, items]) => items.includes(emoji))?.[0]
          ?.toLowerCase() || "";
        return name.includes(searchTerm.toLowerCase());
      });
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <div className="space-y-4">
      {/* Color Picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-1">Color</label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedColor || "#1e40af"}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-lg border border-border"
            />
            <span className="text-sm font-mono text-text-3">{selectedColor || "#1e40af"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div
              className="h-8 w-8 rounded border border-border"
              style={{ backgroundColor: selectedColor ? `${selectedColor}15` : undefined }}
              title="Background (15%)"
            />
            <div
              className="h-8 w-8 rounded border border-border"
              style={{ backgroundColor: selectedColor ? `${selectedColor}20` : undefined }}
              title="Badge (20%)"
            />
          </div>
        </div>
      </div>

      {/* Icon Picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-1">Icon</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex h-10 w-16 items-center justify-center rounded-lg border border-border bg-bg-2 text-2xl hover:bg-bg-3"
          >
            {selectedIcon || "📖"}
          </button>
          <span className="text-sm text-text-3">Click to choose icon</span>
        </div>

        {showPicker && (
          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-text-3" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-2 py-2 pl-8 pr-3 text-sm text-text-1 placeholder-text-3 focus:border-primary focus:outline-none"
              />
            </div>

            {searchTerm ? (
              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                {Object.values(filteredEmojis)
                  .flat()
                  .map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onIconChange(emoji);
                        setShowPicker(false);
                        setSearchTerm("");
                      }}
                      className="flex h-8 items-center justify-center rounded text-lg hover:bg-bg-2"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                  <div key={category}>
                    <button
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                        activeCategory === category
                          ? "bg-primary text-white"
                          : "bg-bg-2 text-text-2 hover:bg-bg-3"
                      }`}
                    >
                      {category}
                    </button>
                    {activeCategory === category && (
                      <div className="mt-2 grid grid-cols-6 gap-2 p-2">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              onIconChange(emoji);
                              setShowPicker(false);
                            }}
                            className="flex h-8 items-center justify-center rounded text-lg hover:bg-bg-3"
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
