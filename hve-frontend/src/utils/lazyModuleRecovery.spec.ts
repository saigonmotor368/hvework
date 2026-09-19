import { describe, expect, it, vi } from "vitest";
import {
  isLazyChunkLoadError,
  loadLazyModuleWithRecovery,
  type LazyModuleRecoveryRuntime,
} from "./lazyModuleRecovery";

const createRuntime = () => {
  const flags = new Map<string, string>();
  const runtime: LazyModuleRecoveryRuntime = {
    getRetryFlag: (key) => flags.get(key) || null,
    setRetryFlag: (key, value) => flags.set(key, value),
    clearRetryFlag: (key) => flags.delete(key),
    prepareReloadUrl: vi.fn(),
    reload: vi.fn(),
  };
  return { flags, runtime };
};

describe("lazy module recovery", () => {
  it("recognizes stale dynamic import errors", () => {
    expect(
      isLazyChunkLoadError(
        new TypeError("Failed to fetch dynamically imported module"),
      ),
    ).toBe(true);
    expect(isLazyChunkLoadError(new Error("Cannot read properties"))).toBe(
      false,
    );
  });

  it("clears the retry guard after a successful import", async () => {
    const { flags, runtime } = createRuntime();
    flags.set("hve:lazy-reload:admin_users", "1");

    await expect(
      loadLazyModuleWithRecovery(
        async () => ({ AdminUserView: "ok" }),
        "admin_users",
        runtime,
      ),
    ).resolves.toEqual({ AdminUserView: "ok" });
    expect(flags.has("hve:lazy-reload:admin_users")).toBe(false);
  });

  it("reloads once and preserves the requested tab on a stale chunk", async () => {
    const { flags, runtime } = createRuntime();
    void loadLazyModuleWithRecovery(
      async () => {
        throw new TypeError("Failed to fetch dynamically imported module");
      },
      "admin_users",
      runtime,
    );

    await vi.waitFor(() => expect(runtime.reload).toHaveBeenCalledOnce());
    expect(runtime.prepareReloadUrl).toHaveBeenCalledWith("admin_users");
    expect(flags.get("hve:lazy-reload:admin_users")).toBe("1");
  });

  it("does not reload repeatedly when the refreshed chunk still fails", async () => {
    const { flags, runtime } = createRuntime();
    flags.set("hve:lazy-reload:tasks", "1");

    await expect(
      loadLazyModuleWithRecovery(
        async () => {
          throw new TypeError("Failed to fetch dynamically imported module");
        },
        "tasks",
        runtime,
      ),
    ).rejects.toThrow("Failed to fetch dynamically imported module");
    expect(runtime.reload).not.toHaveBeenCalled();
    expect(flags.has("hve:lazy-reload:tasks")).toBe(false);
  });
});
