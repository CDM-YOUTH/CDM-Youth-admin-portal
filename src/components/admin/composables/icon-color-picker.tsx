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

  // Flatten all emojis with their category names for search
  const allEmojis = Object.entries(EMOJI_CATEGORIES).flatMap(([category, emojis]) =>
    emojis.map((emoji) => ({ emoji, category }))
  );

  // Filter based on search term (searches category names)
  const filteredEmojis = searchTerm
    ? allEmojis.filter((item) =>
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allEmojis;

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
          <span className="text-sm text-text-3">Click to choose</span>
        </div>

        {showPicker && (
          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-text-3" />
              <input
                type="text"
                placeholder="Search by category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-border bg-bg-2 py-2 pl-8 pr-3 text-sm text-text-1 placeholder-text-3 focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
              {filteredEmojis.map(({ emoji, category }) => (
                <button
                  key={`${emoji}-${category}`}
                  onClick={() => {
                    onIconChange(emoji);
                    setShowPicker(false);
                    setSearchTerm("");
                  }}
                  className="flex h-8 items-center justify-center rounded text-lg hover:bg-bg-2 transition-colors"
                  title={category}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {filteredEmojis.length === 0 && (
              <div className="py-4 text-center text-sm text-text-3">
                No emojis found for "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
