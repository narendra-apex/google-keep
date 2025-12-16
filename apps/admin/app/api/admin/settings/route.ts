import { NextResponse } from "next/server";

import { foundationFetch } from "@/lib/server-actions/foundation";

type Section = "profile" | "webhooks" | "procurement" | "api_keys";

const MOCK = {
  profile: {
    tenant_name: "Default Tenant",
    support_email: "support@example.com",
  },
  webhooks: {
    data: [
      { webhook_id: "wh-001", url: "https://example.com/webhooks", event: "order.created" },
    ],
  },
  procurement: {
    approval_required: true,
    default_currency: "USD",
  },
  api_keys: {
    data: [{ api_key_id: "key-001", name: "CI", last4: "1234" }],
  },
};

function getSection(req: Request): Section {
  const url = new URL(req.url);
  const section = url.searchParams.get("section") as Section | null;
  return section ?? "profile";
}

export async function GET(req: Request) {
  const section = getSection(req);

  try {
    if (section === "profile") {
      const data = await foundationFetch<any>("/tenants/me", { cache: "no-store" });
      return NextResponse.json(data);
    }

    if (section === "webhooks") {
      const data = await foundationFetch<any>("/webhooks", { cache: "no-store" });
      return NextResponse.json(data);
    }

    if (section === "procurement") {
      const data = await foundationFetch<any>("/procurement/preferences", {
        cache: "no-store",
      });
      return NextResponse.json(data);
    }

    if (section === "api_keys") {
      const data = await foundationFetch<any>("/api-keys", { cache: "no-store" });
      return NextResponse.json(data);
    }

    return NextResponse.json(MOCK[section]);
  } catch {
    return NextResponse.json(MOCK[section]);
  }
}

export async function POST(req: Request) {
  const section = getSection(req);
  const payload = await req.json().catch(() => ({}));

  try {
    if (section === "profile") {
      const data = await foundationFetch<any>("/tenants/me", {
        method: "PATCH",
        body: payload,
      });
      return NextResponse.json(data);
    }

    if (section === "webhooks") {
      const data = await foundationFetch<any>("/webhooks", {
        method: "POST",
        body: payload,
      });
      return NextResponse.json(data);
    }

    if (section === "procurement") {
      const data = await foundationFetch<any>("/procurement/preferences", {
        method: "PATCH",
        body: payload,
      });
      return NextResponse.json(data);
    }

    if (section === "api_keys") {
      const data = await foundationFetch<any>("/api-keys", {
        method: "POST",
        body: payload,
      });
      return NextResponse.json(data);
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(payload);
  }
}
