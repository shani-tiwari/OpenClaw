const DOT_CYCLE = ["", ".", "..", "..."];
const TYPING_MS = 4000;
const DOTS_MS = 1200;

export type TelegramLoaderCtx = {
  reply: (text: string, extra?: object) => Promise<{ message_id: number }>;
  chat: { id: number };
  telegram: {
    sendChatAction: (
      chatId: number | string,
      action: "typing",
      extra?: object,
    ) => Promise<unknown>;
    editMessageText: (
      chatId: number | string,
      messageId: number,
      inlineMessageId: undefined,
      text: string,
      extra?: object,
    ) => Promise<unknown>;
    deleteMessage: (chatId: number | string, messageId: number) => Promise<unknown>;
  };
};

export interface TelegramLoaderHandle {
  update(message: string): Promise<void>;
  stop(): Promise<void>;
}

export async function createTelegramLoader(
  ctx: TelegramLoaderCtx,
  initialMessage: string,
): Promise<TelegramLoaderHandle> {
  let message = initialMessage;
  let dots = 0;
  let messageId: number | undefined;

  const renderText = () => `🦞 ${message}${DOT_CYCLE[dots % DOT_CYCLE.length]}`;

  const sent = await ctx.reply(renderText(), { parse_mode: "Markdown" });
  messageId = sent.message_id;

  const typingTimer = setInterval(() => {
    void ctx.telegram.sendChatAction(ctx.chat.id, "typing");
  }, TYPING_MS);
  void ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const dotsTimer = setInterval(() => {
    dots += 1;
    if (messageId === undefined) return;
    void ctx.telegram
      .editMessageText(ctx.chat.id, messageId, undefined, renderText(), {
        parse_mode: "Markdown",
      })
      .catch(() => {});
  }, DOTS_MS);

  return {
    async update(msg: string) {
      message = msg;
      if (messageId === undefined) return;
      await ctx.telegram
        .editMessageText(ctx.chat.id, messageId, undefined, renderText(), {
          parse_mode: "Markdown",
        })
        .catch(() => {});
    },
    async stop() {
      clearInterval(typingTimer);
      clearInterval(dotsTimer);
      if (messageId !== undefined) {
        await ctx.telegram.deleteMessage(ctx.chat.id, messageId).catch(() => {});
        messageId = undefined;
      }
    },
  };
}

export async function withTelegramLoader<T>(
  ctx: TelegramLoaderCtx,
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  const loader = await createTelegramLoader(ctx, message);
  try {
    return await fn();
  } finally {
    await loader.stop();
  }
}
