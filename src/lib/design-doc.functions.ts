import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { desc, eq, inArray } from "drizzle-orm";
import { db, designDocVersions } from "@/db/index.server";
import {
  parseDesignDoc,
  diffDesignDocs,
  type ParsedDesignDoc,
  type DesignDocDiff,
} from "@/lib/design-doc";

export type DesignVersionListItem = {
  id: string;
  version: number;
  label: string | null;
  created_at: string;
};

function toListItem(row: typeof designDocVersions.$inferSelect): DesignVersionListItem {
  return {
    id: row.id,
    version: row.version,
    label: row.label,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

// Personal app — no auth gate (previously requireSupabaseAuth). Anyone with
// the app can read/write design-doc snapshots, mirroring kit behavior.
export const listDesignVersions = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await db
    .select({
      id: designDocVersions.id,
      version: designDocVersions.version,
      label: designDocVersions.label,
      createdAt: designDocVersions.createdAt,
    })
    .from(designDocVersions)
    .orderBy(desc(designDocVersions.version));
  return {
    versions: rows.map((r) => ({
      id: r.id,
      version: r.version,
      label: r.label,
      created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })) as DesignVersionListItem[],
  };
});

export const getDesignVersion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: designDocVersions.id,
        version: designDocVersions.version,
        label: designDocVersions.label,
        markdown: designDocVersions.markdown,
        parsed: designDocVersions.parsed,
        createdAt: designDocVersions.createdAt,
      })
      .from(designDocVersions)
      .where(eq(designDocVersions.id, data.id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error("Version not found");
    return {
      id: row.id,
      version: row.version,
      label: row.label,
      markdown: row.markdown,
      parsed: row.parsed as ParsedDesignDoc,
      created_at:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  });

export const saveDesignVersion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      markdown: z.string().min(1).max(500_000),
      label: z.string().max(200).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const parsed = parseDesignDoc(data.markdown);

    // Find next version number.
    const latest = await db
      .select({ version: designDocVersions.version })
      .from(designDocVersions)
      .orderBy(desc(designDocVersions.version))
      .limit(1);
    const nextVersion = (latest[0]?.version ?? 0) + 1;

    const rows = await db
      .insert(designDocVersions)
      .values({
        version: nextVersion,
        label: data.label ?? null,
        markdown: data.markdown,
        parsed: parsed as unknown as Record<string, unknown>,
        createdBy: null,
      })
      .returning({
        id: designDocVersions.id,
        version: designDocVersions.version,
        label: designDocVersions.label,
        createdAt: designDocVersions.createdAt,
      });
    const row = rows[0];
    if (!row) throw new Error("Failed to save snapshot");
    return {
      id: row.id,
      version: row.version,
      label: row.label,
      created_at:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    } as DesignVersionListItem;
  });

export const diffDesignVersions = createServerFn({ method: "POST" })
  .validator(
    z.object({
      aId: z.string().uuid(),
      bId: z.string().uuid(),
    }).parse,
  )
  .handler(
    async ({
      data,
    }): Promise<{
      a: { version: number; label: string | null; created_at: string };
      b: { version: number; label: string | null; created_at: string };
      diff: DesignDocDiff;
    }> => {
      const rows = await db
        .select({
          id: designDocVersions.id,
          version: designDocVersions.version,
          label: designDocVersions.label,
          parsed: designDocVersions.parsed,
          markdown: designDocVersions.markdown,
          createdAt: designDocVersions.createdAt,
        })
        .from(designDocVersions)
        .where(inArray(designDocVersions.id, [data.aId, data.bId]));
      if (!rows || rows.length < 2) throw new Error("Both versions are required");
      const a = rows.find((r) => r.id === data.aId)!;
      const b = rows.find((r) => r.id === data.bId)!;
      const parsedA =
        a.parsed && Object.keys(a.parsed as object).length > 0
          ? (a.parsed as ParsedDesignDoc)
          : parseDesignDoc(a.markdown as string);
      const parsedB =
        b.parsed && Object.keys(b.parsed as object).length > 0
          ? (b.parsed as ParsedDesignDoc)
          : parseDesignDoc(b.markdown as string);
      const stamp = (r: typeof a) => ({
        version: r.version,
        label: r.label,
        created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      });
      return {
        a: stamp(a),
        b: stamp(b),
        diff: diffDesignDocs(parsedA, parsedB),
      };
    },
  );

export { toListItem };
