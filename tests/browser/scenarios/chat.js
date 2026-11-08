// AI Chat (port of ui_redesign/screens/chat.html).
const C = { page: 'pages/chat.html' };
async function ask(p) {
  await p.fill('#chat-input', 'Which entrance exams do I need for robotics?');
  await p.click('#chat-send');
}
module.exports = [
  { id: 'chat-welcome', ...C, ready: '#chat-welcome:not([hidden]) .chat-sug' },
  { id: 'chat-conversation', ...C, ready: '#chat-welcome .chat-sug',
    after: async p => { await ask(p); await p.waitForSelector('#chat-messages .msg-save'); } },
  { id: 'chat-streaming', ...C, ready: '#chat-welcome .chat-sug', stubs: { 'POST /chat/messages': { delay: 20000 } },
    after: async p => { await ask(p); await p.waitForSelector('#chat-messages .msg-typing'); } },
  { id: 'chat-error', ...C, ready: '#chat-welcome .chat-sug',
    stubs: { 'POST /chat/messages': { status: 200, sse: [{ event: 'error', data: { code: 'stream_error', message: 'The reply stopped unexpectedly.' } }] } },
    after: async p => { await ask(p); await p.waitForSelector('#chat-messages .msg-error'); } },
  { id: 'chat-memory-open', ...C, ready: '#chat-welcome .chat-sug',
    after: async p => { await p.click('#chat-mem-btn'); await p.waitForFunction(() => document.body.classList.contains('chat-mem-open')); await p.waitForTimeout(350); } },
];
