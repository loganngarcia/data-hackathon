"use client";

import type { OrgPerson } from "@/lib/types";
import { avatarColor, getInitials, formatCurrency } from "@/lib/utils";

interface PersonCardProps {
  person: OrgPerson;
}

export default function PersonCard({ person }: PersonCardProps) {
  const color = avatarColor(person.person_name);
  const initials = getInitials(person.person_name);

  return (
    <div className="glass-card p-4 flex items-start gap-3 hover:shadow-lg transition-all duration-200">
      {/* Avatar */}
      <div
        className="avatar-circle flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">
          {person.person_name}
        </p>
        {person.title && (
          <p className="text-xs text-muted truncate">{person.title}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {person.avg_hours_per_week != null && person.avg_hours_per_week > 0 && (
            <span className="text-xs text-muted">
              {person.avg_hours_per_week}h/wk
            </span>
          )}
          {person.compensation != null && person.compensation > 0 && (
            <span className="text-xs text-muted">
              {formatCurrency(person.compensation)}
            </span>
          )}
        </div>

        <div className="flex gap-1.5 mt-2">
          {person.is_officer && (
            <span className="person-badge person-badge-officer">Officer</span>
          )}
          {person.is_director && (
            <span className="person-badge person-badge-director">Director</span>
          )}
        </div>
      </div>
    </div>
  );
}
