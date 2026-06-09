import { desc, sql as dsql } from "drizzle-orm";
import { db } from "@obsidian/db";
import { users, auditLog } from "@obsidian/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { Panel, Badge } from "@/components/ui";
import { SystemHealth } from "@/components/system-health";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  const [userRows, auditRows, counts] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).limit(100),
    db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(100),
    db
      .select({
        users: dsql<number>`count(*)`,
      })
      .from(users),
  ]);

  const userCount = Number(counts[0]?.users ?? 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg-0">Administration</h1>
        <p className="text-sm text-fg-1">
          System status, user management and the security audit trail.
        </p>
      </div>

      <Panel title="System health">
        <SystemHealth />
      </Panel>

      <Panel title={`Users (${userCount})`} bodyClassName="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-fg-2">
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-fg-0">{u.email}</td>
                  <td className="px-4 py-2 text-fg-1">{u.displayName ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge tone={u.role === "admin" ? "warn" : "neutral"}>{u.role}</Badge>
                  </td>
                  <td className="tabular px-4 py-2 text-2xs text-fg-2">
                    {formatDateTime(u.createdAt)}
                  </td>
                  <td className="tabular px-4 py-2 text-2xs text-fg-2">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Audit log" bodyClassName="overflow-hidden">
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 bg-bg-1">
              <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-fg-2">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Detail</th>
                <th className="px-4 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((a) => (
                <tr key={a.id} className="border-b border-line/60 last:border-0">
                  <td className="tabular px-4 py-2 text-2xs text-fg-2">
                    {formatDateTime(a.at)}
                  </td>
                  <td className="px-4 py-2">
                    <code className="rounded bg-bg-2 px-1.5 py-0.5 text-2xs text-fg-1">
                      {a.action}
                    </code>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-2xs text-fg-2">
                    {a.detail ?? "—"}
                  </td>
                  <td className="tabular px-4 py-2 text-2xs text-fg-2">{a.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
