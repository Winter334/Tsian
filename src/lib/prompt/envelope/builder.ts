import type { ContextEnvelope } from "@/domain/types/envelope";

type AIMessage = ContextEnvelope["history"]["messages"][number];

const DEFAULT_ENVELOPE_VERSION = "2.0.0";
const DEFAULT_COMPATIBILITY: NonNullable<ContextEnvelope["compatibility"]> = {
  legacyTags: true,
  fallbackPolicy: "safe-minimal",
};

export class EnvelopeBuilder {
  private draft: Partial<ContextEnvelope> = {
    envelopeVersion: DEFAULT_ENVELOPE_VERSION,
    compatibility: { ...DEFAULT_COMPATIBILITY },
  };

  setSession(session: ContextEnvelope["session"]): this {
    this.draft.session = session;
    return this;
  }

  setTurn(turn: ContextEnvelope["turn"]): this {
    this.draft.turn = turn;
    return this;
  }

  setPresets(presets: ContextEnvelope["presets"]): this {
    this.draft.presets = presets;
    return this;
  }

  setHistory(
    messages: AIMessage[],
    window?: ContextEnvelope["history"]["window"],
  ): this {
    this.draft.history = window ? { messages, window } : { messages };
    return this;
  }

  setMemory(memory: ContextEnvelope["memory"]): this {
    this.draft.memory = memory;
    return this;
  }

  setDirectives(directives: ContextEnvelope["directives"]): this {
    this.draft.directives = directives;
    return this;
  }

  setPostProcess(postProcess: ContextEnvelope["postProcess"]): this {
    this.draft.postProcess = postProcess;
    return this;
  }

  setIoContract(ioContract: ContextEnvelope["ioContract"]): this {
    this.draft.ioContract = ioContract;
    return this;
  }

  setCompatibility(compatibility: ContextEnvelope["compatibility"]): this {
    this.draft.compatibility = {
      ...DEFAULT_COMPATIBILITY,
      ...(compatibility ?? {}),
    };
    return this;
  }

  setTrace(trace: ContextEnvelope["trace"]): this {
    this.draft.trace = trace;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.draft.metadata = metadata;
    return this;
  }

  build(): ContextEnvelope {
    const session = this.draft.session;
    if (!session) {
      throw new Error("EnvelopeBuilder: missing required field session");
    }

    const turn = this.draft.turn;
    if (!turn) {
      throw new Error("EnvelopeBuilder: missing required field turn");
    }

    const history = this.draft.history;
    if (!history?.messages) {
      throw new Error(
        "EnvelopeBuilder: missing required field history.messages",
      );
    }

    const presets = this.draft.presets;
    if (!presets?.activeByPurpose) {
      throw new Error(
        "EnvelopeBuilder: missing required field presets.activeByPurpose",
      );
    }

    const envelope: ContextEnvelope = {
      envelopeVersion: this.draft.envelopeVersion ?? DEFAULT_ENVELOPE_VERSION,
      compatibility: this.draft.compatibility ?? { ...DEFAULT_COMPATIBILITY },
      session,
      turn,
      presets,
      history,
    };

    if (this.draft.memory) {
      envelope.memory = this.draft.memory;
    }

    if (this.draft.directives) {
      envelope.directives = this.draft.directives;
    }

    if (this.draft.postProcess) {
      envelope.postProcess = this.draft.postProcess;
    }

    if (this.draft.ioContract) {
      envelope.ioContract = this.draft.ioContract;
    }

    if (this.draft.trace) {
      envelope.trace = this.draft.trace;
    }

    if (this.draft.metadata) {
      envelope.metadata = this.draft.metadata;
    }

    return envelope;
  }
}
