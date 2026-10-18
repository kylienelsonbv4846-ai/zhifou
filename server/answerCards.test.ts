import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as storage from "./storage";
import * as globalCardGenerator from "./globalAnswerCardGenerator";
import * as answerCardGenerator from "./answerCardGenerator";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "test",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return { ...createContext(), user: null };
}

const card = {
  id: 1,
  cardNumber: 1,
  storageKey: "answer-cards/card-1.pdf",
  storageUrl: "/api/storage/answer-cards/card-1.pdf",
  generatedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Answer Cards Router", { timeout: 30000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists pre-generated answer cards", async () => {
    vi.spyOn(db, "getAllAnswerCardsMetadata").mockResolvedValue([card]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.answerCards.list();

    expect(result).toEqual({
      success: true,
      cards: [card],
      total: 1,
    });
  });

  it("returns a stable local file URL for one answer card", async () => {
    vi.spyOn(db, "getAnswerCardMetadata").mockResolvedValue(card);
    vi.spyOn(storage, "storageGet").mockResolvedValue({
      url: "/api/storage/answer-cards/card-1.pdf",
    });

    const caller = appRouter.createCaller(createContext());
    const result = await caller.answerCards.downloadSingle({ cardNumber: 1 });

    expect(result).toEqual({
      success: true,
      downloadUrl: "/api/storage/answer-cards/card-1.pdf",
      fileName: "answer-card-1.pdf",
    });
    expect(storage.storageGet).toHaveBeenCalledWith(card.storageKey);
  });

  it("returns structured NOT_FOUND errors when an individual answer card is missing", async () => {
    vi.spyOn(db, "getAnswerCardMetadata").mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.answerCards.get({ cardNumber: 80 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "答题卡 80 不存在",
    });
    await expect(caller.answerCards.downloadSingle({ cardNumber: 80 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "答题卡 80 不存在",
    });
  });

  it("rejects downloading all cards when no pre-generated cards exist", async () => {
    vi.spyOn(db, "getAllAnswerCardsMetadata").mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext());

    await expect(caller.answerCards.downloadAll()).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "没有可用的答题卡",
    });
  });

  it("does not build the all-cards ZIP from an anonymous public download", async () => {
    vi.spyOn(db, "getAllAnswerCardsMetadata").mockResolvedValue([card]);
    vi.spyOn(storage, "storageObjectExists").mockResolvedValue(false);
    const getObjectBuffer = vi.spyOn(storage, "storageGetObjectBuffer");
    const putObject = vi.spyOn(storage, "storagePut");

    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.answerCards.downloadAll()).rejects.toThrow("尚未生成");

    expect(getObjectBuffer).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  it("lets an authenticated teacher build the ZIP once under a persistent lock", async () => {
    vi.spyOn(db, "getAllAnswerCardsMetadata").mockResolvedValue([card]);
    vi.spyOn(storage, "storageObjectExists").mockResolvedValue(false);
    vi.spyOn(storage, "storageGetObjectBuffer").mockResolvedValue(Buffer.from("pdf"));
    vi.spyOn(storage, "storagePut").mockResolvedValue({
      url: "/api/storage/answer-cards/downloads/all-cards.zip",
      key: "answer-cards/downloads/all-cards.zip",
    });
    const acquire = vi.spyOn(db, "acquireAnswerCardGenerationLock").mockResolvedValue(true);
    const release = vi.spyOn(db, "releaseAnswerCardGenerationLock").mockResolvedValue(undefined);

    const result = await appRouter.createCaller(createContext()).answerCards.prepareDownloadAll();

    expect(result).toMatchObject({
      success: true,
      downloadUrl: "/api/storage/answer-cards/downloads/all-cards.zip",
      totalCards: 1,
    });
    expect(acquire).toHaveBeenCalledWith("cards:all-cards-zip", expect.stringMatching(/^[a-f0-9-]{36}$/));
    expect(release).toHaveBeenCalledWith("cards:all-cards-zip", expect.any(String));
  });

  it("serves the global PDF cache publicly without generating on a cache miss", async () => {
    vi.spyOn(storage, "storageObjectExists").mockResolvedValue(false);
    const generate = vi.spyOn(globalCardGenerator, "generateGlobalCards");

    await expect(
      appRouter.createCaller(createPublicContext()).globalAnswerCards.download()
    ).rejects.toThrow("尚未生成");

    expect(generate).not.toHaveBeenCalled();
  });

  it("requires an authenticated teacher to generate the global PDF under a persistent lock", async () => {
    vi.spyOn(storage, "storageObjectExists").mockResolvedValue(false);
    vi.spyOn(globalCardGenerator, "generateGlobalCards").mockResolvedValue(
      "/api/storage/answer-cards/global/all-cards.pdf"
    );
    const acquire = vi.spyOn(db, "acquireAnswerCardGenerationLock").mockResolvedValue(true);
    const release = vi.spyOn(db, "releaseAnswerCardGenerationLock").mockResolvedValue(undefined);

    await expect(
      appRouter.createCaller(createPublicContext()).globalAnswerCards.generate()
    ).rejects.toThrow();

    const result = await appRouter.createCaller(createContext()).globalAnswerCards.generate();
    expect(result).toMatchObject({
      url: "/api/storage/answer-cards/global/all-cards.pdf",
      alreadyGenerated: false,
    });
    expect(acquire).toHaveBeenCalledWith("cards:global-pdf", expect.stringMatching(/^[a-f0-9-]{36}$/));
    expect(release).toHaveBeenCalledWith("cards:global-pdf", expect.any(String));
  });

  it("initializes individual cards under a persistent lock only for authenticated teachers", async () => {
    vi.spyOn(db, "isAnswerCardsInitialized").mockResolvedValue(false);
    vi.spyOn(db, "acquireAnswerCardGenerationLock").mockResolvedValue(true);
    const release = vi.spyOn(db, "releaseAnswerCardGenerationLock").mockResolvedValue(undefined);
    vi.spyOn(db, "upsertAnswerCardMetadata").mockResolvedValue(undefined);
    vi.spyOn(answerCardGenerator, "generateSingleCard").mockResolvedValue(Buffer.from("pdf"));
    vi.spyOn(storage, "storagePut").mockResolvedValue({ url: "/api/storage/card.pdf", key: "card.pdf" });

    const anonymousCaller = appRouter.createCaller(createPublicContext());
    await expect(anonymousCaller.system.generateAnswerCards()).rejects.toThrow();

    const result = await appRouter.createCaller(createContext()).system.generateAnswerCards();
    expect(result).toMatchObject({ success: true, totalGenerated: 80, totalErrors: 0 });
    expect(db.acquireAnswerCardGenerationLock).toHaveBeenCalledWith(
      "cards:individual-pdfs",
      expect.stringMatching(/^[a-f0-9-]{36}$/)
    );
    expect(release).toHaveBeenCalledWith("cards:individual-pdfs", expect.any(String));
  });
});
