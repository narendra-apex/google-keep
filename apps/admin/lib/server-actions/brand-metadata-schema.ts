"use server";

import fs from "node:fs/promises";
import path from "node:path";

export type BrandMetadataSchemaExamples = {
  theme?: string;
  workflows?: string;
  feature_flags?: string;
};

async function findSchemaPath() {
  const candidates = [
    path.resolve(process.cwd(), "docs/config/brand-metadata-schema.md"),
    path.resolve(process.cwd(), "..", "..", "docs/config/brand-metadata-schema.md"),
    path.resolve(process.cwd(), "..", "..", "..", "docs/config/brand-metadata-schema.md"),
  ];

  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // keep going
    }
  }

  throw new Error("Could not locate docs/config/brand-metadata-schema.md");
}

function extractFirstJsonAfterHeading(markdown: string, heading: RegExp) {
  const idx = markdown.search(heading);
  if (idx === -1) return undefined;
  const slice = markdown.slice(idx);
  const match = slice.match(/```json\s*([\s\S]*?)```/m);
  return match?.[1]?.trim();
}

export async function getBrandMetadataSchemaExamples(): Promise<BrandMetadataSchemaExamples> {
  const schemaPath = await findSchemaPath();
  const markdown = await fs.readFile(schemaPath, "utf-8");

  return {
    theme: extractFirstJsonAfterHeading(markdown, /##\s+2\.\s+Theme Configuration Schema/),
    workflows: extractFirstJsonAfterHeading(
      markdown,
      /##\s+3\.\s+Workflow Configuration Schema/
    ),
    feature_flags: extractFirstJsonAfterHeading(
      markdown,
      /##\s+4\.\s+Feature Flags Configuration/
    ),
  };
}
