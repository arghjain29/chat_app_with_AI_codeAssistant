import { CHAT_LIMITS, type Member } from '@codecollab/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './composer';

const member = (id: string, username: string): Member => ({
  id,
  username,
  avatarUrl: null,
  role: 'editor',
  joinedAt: new Date().toISOString(),
});

const MEMBERS = [member('me', 'dev'), member('u2', 'maya'), member('u3', 'mira')];

function setup(props: Partial<Parameters<typeof Composer>[0]> = {}) {
  const onSend = vi.fn();
  const onTyping = vi.fn();
  render(
    <Composer
      placeholder="Message the project"
      members={MEMBERS}
      meId="me"
      onSend={onSend}
      onTyping={onTyping}
      {...props}
    />,
  );
  return { onSend, onTyping, box: screen.getByRole('textbox') };
}

describe('sending', () => {
  it('sends on Enter and clears the box', async () => {
    const { onSend, box } = setup();
    await userEvent.type(box, 'ship it{Enter}');
    expect(onSend).toHaveBeenCalledWith('ship it');
    expect(box).toHaveValue('');
  });

  it('keeps Shift+Enter for a new line', async () => {
    const { onSend, box } = setup();
    await userEvent.type(box, 'one{Shift>}{Enter}{/Shift}two');
    expect(onSend).not.toHaveBeenCalled();
    expect(box).toHaveValue('one\ntwo');
  });

  it('ignores whitespace-only messages', async () => {
    const { onSend, box } = setup();
    await userEvent.type(box, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('refuses to send a message over the length limit', async () => {
    const { onSend, box } = setup();
    // Typing 4,001 characters one keystroke at a time is far too slow.
    await userEvent.click(box);
    await userEvent.paste('x'.repeat(CHAT_LIMITS.maxMessageLength + 5));
    await userEvent.type(box, '{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('5 characters over the limit')).toBeInTheDocument();
  });
});

describe('mentions', () => {
  it('suggests members as you type @, and inserts the one you pick', async () => {
    const { box } = setup();
    await userEvent.type(box, 'ping @m');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2); // Not me, and not the AI unless it's switched on.
    expect(options[0]).toHaveTextContent('maya');
    expect(options[1]).toHaveTextContent('mira');

    await userEvent.type(box, '{ArrowDown}{Enter}');
    expect(box).toHaveValue('ping @mira ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('never offers you to yourself', async () => {
    const { box } = setup();
    await userEvent.type(box, '@d');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('offers @ai only where the AI is available', async () => {
    const { box } = setup({ aiEnabled: true });
    await userEvent.type(box, '@a');
    expect(screen.getByRole('option', { name: /AI assistant/ })).toBeInTheDocument();

    await userEvent.type(box, '{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('leaves @ai out when the AI is off', async () => {
    const { box } = setup({ aiEnabled: false });
    await userEvent.type(box, '@a');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('typing signal', () => {
  it('reports typing once while someone types, and stops after sending', async () => {
    const { onTyping, box } = setup();
    await userEvent.type(box, 'hello');
    expect(onTyping).toHaveBeenCalledTimes(1);
    expect(onTyping).toHaveBeenCalledWith(true);

    await userEvent.type(box, '{Enter}');
    expect(onTyping).toHaveBeenLastCalledWith(false);
  });
});

it('shows how much AI quota is left', () => {
  setup({ aiEnabled: true, aiHint: '27 AI requests left today' });
  expect(screen.getByText('27 AI requests left today')).toBeInTheDocument();
});
