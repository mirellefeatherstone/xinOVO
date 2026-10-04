import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

const scripts = read('src/html/scripts.html');
for (const source of [
    'js/modules/telegram-bubble-width.js',
    'js/modules/contacts-index.js',
    'js/modules/wechat_emoji.js',
    'js/modules/wechat_game.js',
    'js/modules/phone-keypad.js',
]) {
    assert.match(scripts, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(exists(source), `${source} is missing`);
}

assert.match(read('css/chat.css'), /@import url\(['"]modules\/contacts-index\.css['"]\)/);
assert.ok(exists('css/modules/contacts-index.css'));

const emojiAssets = fs.readdirSync(path.join(root, 'assets/wechat-emoji'));
assert.ok(emojiAssets.length >= 100, 'WeChat emoji assets are incomplete');
for (const asset of [
    'assets/wechat-game/dice-1.png',
    'assets/wechat-game/dice-6.png',
    'assets/wechat-game/rps-rock.png',
    'assets/wechat-game/rps-paper.png',
    'assets/wechat-game/rps-scissors.png',
]) assert.ok(exists(asset), `${asset} is missing`);

const promptHelpers = read('js/modules/chat-ai/prompt-helpers.js');
const responseControl = read('js/modules/chat-ai/response-and-control.js');
const messageBubble = read('js/modules/chat-render/message-bubble.js');
const historyFilter = read('js/core/ui-and-content-utils.js');
const persistence = read('js/data/indexed-db.js');
const callParts = [1, 2, 3]
    .map(number => read(`src/js/modules/video-call/part-0${number}.jsfrag`))
    .join('\n');

assert.match(promptHelpers, /<call_retry>1-5<\/call_retry>/);
assert.match(promptHelpers, /发送的表情包：骰子/);
assert.match(responseControl, /receiveCall\(type, targetChatId, callMaxAttempts\)/);
assert.match(responseControl, /resolveAiStickerName/);
assert.match(messageBubble, /message\.isCallMessage/);
assert.match(messageBubble, /VideoCallModule\?\.showDetailModal/);
assert.match(messageBubble, /WeChatEmoji\?\.renderInElement/);
assert.match(historyFilter, /等待30秒无人接听后由你结束拨号/);
assert.match(historyFilter, /没有主动挂断或拒绝/);
assert.match(persistence, /stopIncomingRetriesForNewUserMessage/);
assert.match(callParts, /setTimeout\(\(\) => \{\s*void this\.handleIncomingNoAnswer\(session\);\s*\}, 30000\)/);
assert.match(callParts, /maxAttempts: Math\.max\(1, Math\.min\(5/);
assert.match(callParts, /isCallSummary: true/);
assert.match(callParts, /hiddenFromDisplay: true/);
assert.match(callParts, /showDetailModal: function\(recordId\)/);

console.log('Custom patch wiring is intact.');
