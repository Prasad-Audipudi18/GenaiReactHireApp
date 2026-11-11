import { useState } from "react";

// Type a skill and press Enter or comma to add it as a chip.
export default function SkillInput({ id, skills, onChange, placeholder }) {
  const [draft, setDraft] = useState("");

  const add = (raw) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...skills];
    parts.forEach((p) => {
      if (!next.some((s) => s.toLowerCase() === p.toLowerCase())) next.push(p);
    });
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (e) => {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && skills.length) {
      onChange(skills.slice(0, -1));
    }
  };

  return (
    <div className="chip-input" onClick={() => document.getElementById(id)?.focus()}>
      {skills.map((s) => (
        <span className="chip" key={s}>
          {s}
          <button type="button" aria-label={`Remove ${s}`} onClick={() => onChange(skills.filter((x) => x !== s))}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={skills.length ? "" : placeholder}
      />
    </div>
  );
}
