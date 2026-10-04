(() => {
    const messageAreaSelector = '#chat-room-screen .message-area';
    const bubbleSelector = '.message-bubble:not(.html-bubble)';
    const contentSelector = ':scope > .bubble-content, :scope.bilingual-bubble > span:first-child, :scope > .bilingual-main-text, :scope > .translation-inner, :scope > .quoted-message';
    const optInProperty = '--uwu-telegram-bubble-width';
    const managed = new WeakSet();
    const queued = new Set();
    const visible = new Set();
    let frameId = 0;

    const px = value => Number.parseFloat(value) || 0;
    const contentsFor = bubble => Array.from(bubble.querySelectorAll(contentSelector));
    const isTextBubble = node => node instanceof HTMLElement
        && node.matches(bubbleSelector)
        && contentsFor(node).length > 0;

    function measureContent(contents, bubble) {
        const style = getComputedStyle(bubble);
        const rect = bubble.getBoundingClientRect();
        const left = rect.left + px(style.borderLeftWidth) + px(style.paddingLeft);
        let widest = 0;
        let trailing = 0;
        let trailingBottom = -Infinity;

        contents.forEach(content => {
            const range = document.createRange();
            range.selectNodeContents(content);
            Array.from(range.getClientRects()).forEach(line => {
                if (line.width <= 0 || line.height <= 0) return;
                const right = Math.max(0, line.right - left);
                widest = Math.max(widest, right);
                if (line.bottom > trailingBottom + 0.5) {
                    trailingBottom = line.bottom;
                    trailing = right;
                } else if (Math.abs(line.bottom - trailingBottom) <= 0.5) {
                    trailing = Math.max(trailing, right);
                }
            });
        });

        return { widest, trailing };
    }

    function timestampWidth(bubble) {
        const timestamp = bubble.querySelector(':scope > .message-time');
        if (!(timestamp instanceof HTMLElement) || timestamp.getClientRects().length === 0) return 0;
        const bubbleDisplay = getComputedStyle(bubble).display;
        if (['grid', 'inline-grid', 'flex', 'inline-flex'].includes(bubbleDisplay)) return 0;

        const style = getComputedStyle(timestamp);
        if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0) return 0;
        if (!(style.float !== 'none' || style.display.startsWith('inline'))) return 0;
        if (style.position === 'absolute' || style.position === 'fixed') return 0;
        return timestamp.getBoundingClientRect().width + px(style.marginLeft) + px(style.marginRight);
    }

    function declaredWidth(bubble, contentWidth) {
        const style = getComputedStyle(bubble);
        if (style.boxSizing !== 'border-box') return contentWidth;
        return contentWidth + px(style.paddingLeft) + px(style.paddingRight)
            + px(style.borderLeftWidth) + px(style.borderRightWidth);
    }

    function fit(bubble) {
        if (!bubble.isConnected || !isTextBubble(bubble) || bubble.getClientRects().length === 0) return;
        if (getComputedStyle(bubble).getPropertyValue(optInProperty).trim() !== '1') {
            if (managed.has(bubble)) {
                bubble.style.removeProperty('width');
                managed.delete(bubble);
            }
            return;
        }
        if (!managed.has(bubble)) {
            if (bubble.style.getPropertyValue('width')) return;
            managed.add(bubble);
        }

        bubble.style.width = 'max-content';
        const { widest, trailing } = measureContent(contentsFor(bubble), bubble);
        const width = declaredWidth(bubble, Math.max(widest, trailing + timestampWidth(bubble)));
        bubble.style.width = `${Math.ceil(width * 2) / 2}px`;
    }

    function processQueue() {
        frameId = 0;
        let count = 0;
        for (const bubble of queued) {
            queued.delete(bubble);
            fit(bubble);
            if (++count >= 12) break;
        }
        if (queued.size) frameId = requestAnimationFrame(processQueue);
    }

    function queue(bubble) {
        if (!isTextBubble(bubble)) return;
        queued.add(bubble);
        if (!frameId) frameId = requestAnimationFrame(processQueue);
    }

    function find(root) {
        const bubbles = [];
        if (isTextBubble(root)) bubbles.push(root);
        if (root instanceof Element || root instanceof DocumentFragment) {
            root.querySelectorAll(bubbleSelector).forEach(bubble => {
                if (isTextBubble(bubble)) bubbles.push(bubble);
            });
        }
        return bubbles;
    }

    function setup() {
        const messageArea = document.querySelector(messageAreaSelector);
        if (!messageArea) return;

        const intersectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    visible.add(entry.target);
                    queue(entry.target);
                } else {
                    visible.delete(entry.target);
                }
            });
        }, { root: messageArea, rootMargin: '160px 0px' });

        const observe = root => find(root).forEach(bubble => intersectionObserver.observe(bubble));
        observe(messageArea);
        new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(observe);
                const bubble = mutation.target instanceof Element
                    ? mutation.target.closest(bubbleSelector)
                    : mutation.target.parentElement?.closest(bubbleSelector);
                if (bubble && visible.has(bubble)) queue(bubble);
            });
        }).observe(messageArea, { childList: true, characterData: true, subtree: true });

        new MutationObserver(() => visible.forEach(queue)).observe(document.head, {
            childList: true,
            characterData: true,
            subtree: true,
        });

        let messageAreaWidth = messageArea.clientWidth;
        new ResizeObserver(entries => {
            const width = entries[0]?.contentRect.width || 0;
            if (Math.abs(width - messageAreaWidth) < 0.5) return;
            messageAreaWidth = width;
            visible.forEach(queue);
        }).observe(messageArea);

        document.fonts?.addEventListener?.('loadingdone', () => visible.forEach(queue));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
    else setup();
})();
