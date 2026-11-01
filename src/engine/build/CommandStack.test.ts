import { describe, expect, it } from 'vitest';
import { CommandStack, type Command } from './CommandStack';

function counter(): { value: number; add: (n: number) => Command } {
  const state = { value: 0 };
  return {
    get value() {
      return state.value;
    },
    add: (n: number) => ({
      label: `add ${n}`,
      execute: () => {
        state.value += n;
      },
      undo: () => {
        state.value -= n;
      },
    }),
  };
}

describe('CommandStack', () => {
  it('executes, undoes and redoes in order', () => {
    const stack = new CommandStack();
    const c = counter();
    stack.execute(c.add(1));
    stack.execute(c.add(10));
    expect(c.value).toBe(11);
    expect(stack.undo()?.label).toBe('add 10');
    expect(c.value).toBe(1);
    expect(stack.redo()?.label).toBe('add 10');
    expect(c.value).toBe(11);
    expect(stack.undo()).not.toBeNull();
    expect(stack.undo()).not.toBeNull();
    expect(stack.undo()).toBeNull();
    expect(c.value).toBe(0);
  });

  it('clears the redo branch when a new command runs', () => {
    const stack = new CommandStack();
    const c = counter();
    stack.execute(c.add(1));
    stack.execute(c.add(2));
    stack.undo();
    expect(stack.canRedo).toBe(true);
    stack.execute(c.add(5));
    expect(stack.canRedo).toBe(false);
    expect(c.value).toBe(6);
  });

  it('forgets the oldest commands past its limit', () => {
    const stack = new CommandStack(2);
    const c = counter();
    stack.execute(c.add(1));
    stack.execute(c.add(2));
    stack.execute(c.add(4));
    expect(stack.undo()).not.toBeNull();
    expect(stack.undo()).not.toBeNull();
    expect(stack.undo()).toBeNull();
    expect(c.value).toBe(1);
  });
});
