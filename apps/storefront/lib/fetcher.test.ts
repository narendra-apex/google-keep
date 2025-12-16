import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetcher } from "./fetcher";

global.fetch = vi.fn();

describe("fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should attach x-tenant-id header when provided", async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: "test" }) };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await fetcher("https://api.example.com/products", {
      tenantId: "tenant-123",
    });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[1].headers.get("x-tenant-id")).toBe("tenant-123");
  });

  it("should attach x-brand-id header when provided", async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: "test" }) };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await fetcher("https://api.example.com/products", {
      brandId: "brand-456",
    });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[1].headers.get("x-brand-id")).toBe("brand-456");
  });

  it("should attach both tenant and brand headers", async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: "test" }) };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await fetcher("https://api.example.com/products", {
      tenantId: "tenant-123",
      brandId: "brand-456",
    });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[1].headers.get("x-tenant-id")).toBe("tenant-123");
    expect(call[1].headers.get("x-brand-id")).toBe("brand-456");
  });

  it("should throw on non-ok response", async () => {
    const mockResponse = { ok: false, status: 404 };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await expect(
      fetcher("https://api.example.com/products")
    ).rejects.toThrow("Fetch failed");
  });

  it("should return JSON response on success", async () => {
    const mockData = { products: [{ id: 1, name: "Test Product" }] };
    const mockResponse = { ok: true, json: () => Promise.resolve(mockData) };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const result = await fetcher("https://api.example.com/products");

    expect(result).toEqual(mockData);
  });

  it("should preserve custom request options", async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({}) };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    await fetcher("https://api.example.com/products", {
      method: "POST",
      tenantId: "tenant-123",
    });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[1].method).toBe("POST");
  });
});
