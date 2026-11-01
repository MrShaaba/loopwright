export interface Command {
  label: string;
  execute(): void;
  undo(): void;
}

/** Undo and redo over reversible commands. */
export class CommandStack {
  private readonly done: Command[] = [];
  private undone: Command[] = [];

  constructor(private readonly limit = 200) {}

  execute(command: Command): void {
    command.execute();
    this.done.push(command);
    this.undone = [];
    if (this.done.length > this.limit) this.done.shift();
  }

  undo(): Command | null {
    const command = this.done.pop();
    if (!command) return null;
    command.undo();
    this.undone.push(command);
    return command;
  }

  redo(): Command | null {
    const command = this.undone.pop();
    if (!command) return null;
    command.execute();
    this.done.push(command);
    return command;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  clear(): void {
    this.done.length = 0;
    this.undone = [];
  }
}
