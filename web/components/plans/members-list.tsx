import { Users } from "lucide-react";
import { roleLabels, type PlanMember } from "@/lib/saved-plans";
import { panelClass } from "./shared";

const roleOrder = { leader: 0, co_leader: 1, member: 2 };

export function MembersList({ members }: { members?: PlanMember[] }) {
  return <section aria-labelledby="members-heading" className={panelClass}>
    <h2 id="members-heading" className="flex items-center gap-2 text-2xl font-bold">
      <Users aria-hidden="true" className="text-teal-300" />Members
      {members && <span className="text-base font-normal text-slate-400">({members.length})</span>}
    </h2>

    {!members ? <p className="mt-3 text-sm text-slate-400">
      The members list will appear once group plans are connected.
    </p> : <ul className="mt-5 divide-y divide-white/10">
      {[...members]
        .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.name.localeCompare(b.name))
        .map(member => <li key={member.userId} className="flex items-center justify-between gap-4 py-3">
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-300/15 font-semibold text-teal-200">
              {member.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className="truncate">{member.name}{member.isYou && <span className="text-slate-400"> (you)</span>}</span>
          </span>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${member.role === "member" ? "bg-white/5 text-slate-300" : "bg-teal-300/10 text-teal-200"}`}>
            {roleLabels[member.role]}
          </span>
        </li>)}
    </ul>}
  </section>;
}
