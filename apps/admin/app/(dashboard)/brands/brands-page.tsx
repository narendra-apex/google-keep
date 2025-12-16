"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useBrands, useBrandConfigSection } from "@/lib/hooks/useBrands";
import { Can } from "@/lib/rbac";

type Section = "theme" | "workflows" | "feature-flags";

function prettyJson(v: unknown) {
  return JSON.stringify(v ?? {}, null, 2);
}

export function BrandsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const page = Number(params.get("page") ?? "1");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  const limit = 12;
  const offset = (safePage - 1) * limit;

  const { brandsQuery, productsQuery, categoriesQuery, schemaExamplesQuery, updateConfigMutation } =
    useBrands({ limit, offset });

  const [selectedBrandId, setSelectedBrandId] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<Section>("theme");
  const [editorValue, setEditorValue] = React.useState<string>("{}");

  const selectedBrand = brandsQuery.data?.data.find((b) => b.id === selectedBrandId) ?? null;

  const themeQuery = useBrandConfigSection<any>(selectedBrandId ?? undefined, "theme");
  const workflowsQuery = useBrandConfigSection<any>(selectedBrandId ?? undefined, "workflows");
  const flagsQuery = useBrandConfigSection<any>(selectedBrandId ?? undefined, "feature-flags");

  const sectionData =
    section === "theme"
      ? themeQuery.data
      : section === "workflows"
        ? workflowsQuery.data
        : flagsQuery.data;

  React.useEffect(() => {
    if (!selectedBrandId) return;
    if (sectionData && Object.keys(sectionData).length > 0) {
      setEditorValue(prettyJson(sectionData));
      return;
    }

    const examples = schemaExamplesQuery.data;
    if (section === "theme" && examples?.theme) setEditorValue(prettyJson(JSON.parse(examples.theme)));
    if (section === "workflows" && examples?.workflows)
      setEditorValue(prettyJson(JSON.parse(examples.workflows)));
    if (section === "feature-flags" && examples?.feature_flags)
      setEditorValue(prettyJson(JSON.parse(examples.feature_flags)));
  }, [selectedBrandId, section, sectionData, schemaExamplesQuery.data]);

  const total = brandsQuery.data?.meta?.total;
  const hasPrev = safePage > 1;
  const hasNext = total ? offset + limit < total : (brandsQuery.data?.data.length ?? 0) === limit;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold md:text-2xl">Brands</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={!hasPrev}
            onClick={() => router.push(`/brands?page=${safePage - 1}`)}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            disabled={!hasNext}
            onClick={() => router.push(`/brands?page=${safePage + 1}`)}
          >
            Next
          </Button>
        </div>
      </div>

      {brandsQuery.isLoading ? <LoadingState label="Loading brands" /> : null}
      {brandsQuery.isError ? (
        <EmptyState
          title="Failed to load brands"
          description="Check your Foundation API configuration or try again."
          action={<Button onClick={() => brandsQuery.refetch()}>Retry</Button>}
        />
      ) : null}

      {!brandsQuery.isLoading && !brandsQuery.isError && (brandsQuery.data?.data.length ?? 0) === 0 ? (
        <EmptyState
          title="No brands"
          description="Create a brand in the Foundation service to see it here."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(brandsQuery.data?.data ?? []).map((brand) => (
          <Card key={brand.id} className="cursor-pointer" onClick={() => setSelectedBrandId(brand.id)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{brand.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Brand ID: {brand.id}</div>
              <div className="mt-2">Click to manage config</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Drawer
        open={Boolean(selectedBrand)}
        onOpenChange={(open) => {
          if (!open) setSelectedBrandId(null);
        }}
        title={selectedBrand ? `Brand: ${selectedBrand.name}` : "Brand"}
      >
        {!selectedBrand ? null : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Products</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {productsQuery.data?.data.length ?? "—"}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Categories</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {categoriesQuery.data?.data.length ?? "—"}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Config</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Theme / Workflows / Feature Flags
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={section === "theme" ? "default" : "outline"}
                onClick={() => setSection("theme")}
              >
                Theme
              </Button>
              <Button
                variant={section === "workflows" ? "default" : "outline"}
                onClick={() => setSection("workflows")}
              >
                Workflows
              </Button>
              <Button
                variant={section === "feature-flags" ? "default" : "outline"}
                onClick={() => setSection("feature-flags")}
              >
                Feature Flags
              </Button>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">{section} editor (JSON)</div>
              <Textarea
                value={editorValue}
                onChange={(e) => setEditorValue(e.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Schema examples sourced from docs/config/brand-metadata-schema.md
                </div>
                <Can
                  scope={["brands.config.write"]}
                  fallback={
                    <div className="text-xs text-muted-foreground">
                      Missing scope: brands.config.write
                    </div>
                  }
                >
                  <Button
                    disabled={updateConfigMutation.isPending}
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(editorValue);
                        updateConfigMutation.mutate({
                          brandId: selectedBrand.id,
                          section,
                          value: parsed,
                        });
                      } catch {
                        toast({
                          title: "Invalid JSON",
                          description: "Fix the JSON before saving.",
                          variant: "error",
                        });
                      }
                    }}
                  >
                    {updateConfigMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </Can>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
