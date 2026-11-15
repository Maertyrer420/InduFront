import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// What a player in debt actually ends up looking at. The Api-level mapping
// lives in TribeNameDebt.test.ts; here the wrappers are stubbed so these
// exercise the panel's branches on the result code.
//
// The purchase path is the one that stung: its 400 folded into `invalid`,
// whose `message` the panel prints verbatim — so a charged-back player was
// shown the literal string "insufficient_balance_debt".

const {
  purchaseTribeName,
  boostTribeName,
  getMyTribeNames,
  getUserMe,
  invalidateUserMe,
  fetchCosmetics,
  showInGameConfirm,
} = vi.hoisted(() => ({
  purchaseTribeName: vi.fn(),
  boostTribeName: vi.fn(),
  getMyTribeNames: vi.fn(),
  getUserMe: vi.fn(),
  invalidateUserMe: vi.fn(),
  fetchCosmetics: vi.fn(),
  showInGameConfirm: vi.fn(),
}));

vi.mock("../../src/client/Api", () => ({
  purchaseTribeName: (name: string) => purchaseTribeName(name),
  boostTribeName: (id: string, key: string) => boostTribeName(id, key),
  getMyTribeNames: () => getMyTribeNames(),
  getUserMe: () => getUserMe(),
  invalidateUserMe: () => invalidateUserMe(),
}));
vi.mock("../../src/client/Cosmetics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Cosmetics")>()),
  fetchCosmetics: () => fetchCosmetics(),
}));
vi.mock("../../src/client/InGameModal", () => ({
  showInGameConfirm: (message: string, options?: unknown) =>
    showInGameConfirm(message, options),
  showInGameAlert: vi.fn(async () => true),
}));
vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  // Echo the key and its interpolations so assertions can read both.
  translateText: (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

import type { UserMeResponse } from "@openfront/shared/ApiSchemas";
import "../../src/client/components/TribesPanel";
import {
  TRIBE_NAME_STEEL_PRICE,
  type TribesPanel,
} from "../../src/client/components/TribesPanel";
import { SteelStoreService } from "../../src/client/SteelStore";

const BOOST_PRICE_HARD = 50;

function userWithHard(hard: number): UserMeResponse {
  return {
    user: {},
    player: { publicId: "p", flares: [], currency: { hard, soft: 0 } },
  } as unknown as UserMeResponse;
}

// Comfortably above both prices, so the client-side pre-checks pass and the
// request is actually made — the refusals under test all come from the server.
const userMe = userWithHard(500);

const tribe = {
  id: "7",
  displayName: "Ronin",
  status: "live",
  reviewReason: null,
  activeBoosts: 0,
  boostExpiresAt: null,
};

async function mount(): Promise<TribesPanel> {
  const el = document.createElement("tribes-panel") as TribesPanel;
  el.userMeResponse = userMe;
  document.body.appendChild(el);
  await el.updateComplete;
  // updated() kicks off the list + cosmetics fetch; let both settle and the
  // resulting re-render land.
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  return el;
}

async function buy(el: TribesPanel, name: string) {
  const input = el.querySelector<HTMLInputElement>("#tribe-name-input")!;
  input.value = name;
  el.querySelector("form")!.dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
}

async function boost(el: TribesPanel) {
  const button = [...el.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("store.tribe_boost_button"),
  )!;
  button.click();
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
}

function dialog(el: TribesPanel) {
  return el.querySelector("insufficient-currency-dialog") as HTMLElement & {
    info: unknown;
  };
}

describe("TribesPanel when the wallet is in debt", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    getMyTribeNames.mockResolvedValue({ names: [tribe] });
    getUserMe.mockResolvedValue(userMe);
    fetchCosmetics.mockResolvedValue({
      tribeNames: {
        priceHard: 200,
        boostPriceHard: BOOST_PRICE_HARD,
        boostDurationDays: 30,
      },
    });
    showInGameConfirm.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  describe("buying a name with Steel", () => {
    it("shows insufficient Steel error when balance is below 1,000,000", async () => {
      vi.spyOn(SteelStoreService, "getBalance").mockReturnValue(500);
      const setBalanceSpy = vi.spyOn(SteelStoreService, "setBalance");
      const el = await mount();

      await buy(el, "Ninja");

      expect(el.textContent).toContain("Nicht genug Stahl!");
      expect(purchaseTribeName).not.toHaveBeenCalled();
      expect(setBalanceSpy).not.toHaveBeenCalled();
    });

    it("rejects names shorter than 3 characters", async () => {
      vi.spyOn(SteelStoreService, "getBalance").mockReturnValue(
        TRIBE_NAME_STEEL_PRICE,
      );
      const setBalanceSpy = vi.spyOn(SteelStoreService, "setBalance");
      const el = await mount();

      await buy(el, "ab");

      expect(el.textContent).toContain(
        "Der Tribe-Name muss mindestens 3 Zeichen lang sein.",
      );
      expect(purchaseTribeName).not.toHaveBeenCalled();
      expect(setBalanceSpy).not.toHaveBeenCalled();
    });

    it("rejects names longer than 30 characters", async () => {
      vi.spyOn(SteelStoreService, "getBalance").mockReturnValue(
        TRIBE_NAME_STEEL_PRICE,
      );
      const setBalanceSpy = vi.spyOn(SteelStoreService, "setBalance");
      const el = await mount();

      await buy(el, "a".repeat(31));

      expect(el.textContent).toContain(
        "Der Tribe-Name darf maximal 30 Zeichen lang sein.",
      );
      expect(purchaseTribeName).not.toHaveBeenCalled();
      expect(setBalanceSpy).not.toHaveBeenCalled();
    });

    it("deducts Steel and registers community tribe when balance is sufficient", async () => {
      vi.spyOn(SteelStoreService, "getBalance").mockReturnValue(
        TRIBE_NAME_STEEL_PRICE + 250,
      );
      const setBalanceSpy = vi.spyOn(SteelStoreService, "setBalance");
      purchaseTribeName.mockResolvedValue({ ok: true, id: "99" });
      const el = await mount();

      await buy(el, "Ninja");

      expect(setBalanceSpy).toHaveBeenCalledWith(250);
      expect(purchaseTribeName).toHaveBeenCalledWith("Ninja");
      expect(el.textContent).toContain('Tribe "Ninja" erfolgreich');
      expect(el.textContent).toContain("Ninja");
    });
  });

  // The API serves a charged-back wallet as a negative balance, so the panel
  // can see the debt before it spends a request.
  describe("with a negative balance already bound", () => {
    it("allows Steel tribe purchase regardless of negative Plutonium when Steel is sufficient", async () => {
      vi.spyOn(SteelStoreService, "getBalance").mockReturnValue(
        TRIBE_NAME_STEEL_PRICE,
      );
      purchaseTribeName.mockResolvedValue({ ok: true, id: "100" });
      const el = await mount();
      el.userMeResponse = userWithHard(-150);
      await el.updateComplete;

      await buy(el, "SteelClan");

      expect(purchaseTribeName).toHaveBeenCalledWith("SteelClan");
      expect(el.textContent).not.toContain("store.pack_debt");
      expect(dialog(el).info).toBeNull();
    });

    it("explains the debt instead of boosting", async () => {
      const el = await mount();
      el.userMeResponse = userWithHard(-150);
      await el.updateComplete;

      await boost(el);

      expect(el.textContent).toContain('store.pack_debt:{"debt":"150"}');
      expect(boostTribeName).not.toHaveBeenCalled();
      // Not the top-up dialog: buying plutonium does not clear a debt.
      expect(dialog(el).info).toBeNull();
    });
  });

  // The boundary the debt pre-check must not swallow: an empty wallet is not
  // a debt.
  describe("with an empty wallet", () => {
    it("shows insufficient Steel prompt rather than Plutonium debt when Steel is 0", async () => {
      vi.spyOn(SteelStoreService, "getBalance").mockReturnValue(0);
      const el = await mount();
      el.userMeResponse = userWithHard(0);
      await el.updateComplete;

      await buy(el, "Ninja");

      expect(el.textContent).not.toContain("store.pack_debt");
      expect(el.textContent).toContain("Nicht genug Stahl!");
    });

    it("offers the top-up dialog rather than a debt message when boosting", async () => {
      const el = await mount();
      el.userMeResponse = userWithHard(0);
      await el.updateComplete;

      await boost(el);

      expect(el.textContent).not.toContain("store.pack_debt");
      expect(dialog(el).info).toMatchObject({ shortfall: BOOST_PRICE_HARD });
    });
  });

  // Boost refetch outcome tests.
  describe("when the refetched balance explains the refusal differently", () => {
    beforeEach(() => {
      boostTribeName.mockResolvedValue({
        ok: false,
        code: "insufficient_balance",
      });
    });

    it("explains the debt on the boost path too", async () => {
      getUserMe.mockResolvedValue(userWithHard(-80));
      const el = await mount();

      await boost(el);

      expect(el.textContent).toContain('store.pack_debt:{"debt":"80"}');
      expect(dialog(el).info).toBeNull();
    });
  });

  describe("boosting a name", () => {
    it("explains the debt instead of offering a top-up", async () => {
      boostTribeName.mockResolvedValue({
        ok: false,
        code: "debt",
        debt: "80",
      });
      const el = await mount();

      await boost(el);

      expect(el.textContent).toContain('store.pack_debt:{"debt":"80"}');
      expect(dialog(el).info).toBeNull();
    });

    it("still offers the top-up dialog when merely short", async () => {
      boostTribeName.mockResolvedValue({
        ok: false,
        code: "insufficient_balance",
      });
      getUserMe.mockResolvedValue(userWithHard(20));
      const el = await mount();

      await boost(el);

      expect(dialog(el).info).toMatchObject({
        shortfall: BOOST_PRICE_HARD - 20,
        item: "Ronin",
        canTopUp: true,
      });
      expect(el.textContent).not.toContain("store.pack_debt");
    });
  });
});
