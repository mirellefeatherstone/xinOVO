(() => {
    async function openTextStream(file) {
        const signature = new Uint8Array(await file.slice(0, 2).arrayBuffer());
        const stream = file.stream();
        return signature[0] === 0x1f && signature[1] === 0x8b
            ? stream.pipeThrough(new DecompressionStream('gzip'))
            : stream;
    }

    class TopLevelJsonParser {
        constructor(handlers) {
            this.handlers = handlers;
            this.streamArrays = handlers.streamArrays || new Set();
            this.streamObjects = handlers.streamObjects || new Set();
            this.state = 'root-start';
            this.rootKey = '';
            this.objectKey = '';
            this.raw = null;
            this.done = false;
        }

        startRaw(firstCharacter, onValue) {
            const container = firstCharacter === '{' || firstCharacter === '[';
            this.raw = {
                parts: [],
                kind: container ? 'container' : (firstCharacter === '"' ? 'string' : 'primitive'),
                depth: container ? 0 : null,
                inString: false,
                escaped: false,
                onValue,
            };
        }

        consumeRaw(text, start) {
            const raw = this.raw;
            let index = start;
            for (; index < text.length; index++) {
                const character = text[index];
                if (raw.kind === 'primitive') {
                    if (/\s/.test(character) || character === ',' || character === '}' || character === ']') {
                        raw.parts.push(text.slice(start, index));
                        return { index, complete: true };
                    }
                    continue;
                }

                if (raw.inString) {
                    if (raw.escaped) raw.escaped = false;
                    else if (character === '\\') raw.escaped = true;
                    else if (character === '"') {
                        raw.inString = false;
                        if (raw.kind === 'string') {
                            raw.parts.push(text.slice(start, index + 1));
                            return { index: index + 1, complete: true };
                        }
                    }
                    continue;
                }

                if (character === '"') raw.inString = true;
                else if (character === '{' || character === '[') raw.depth++;
                else if (character === '}' || character === ']') {
                    raw.depth--;
                    if (raw.depth === 0) {
                        raw.parts.push(text.slice(start, index + 1));
                        return { index: index + 1, complete: true };
                    }
                }
            }
            raw.parts.push(text.slice(start));
            return { index, complete: false };
        }

        async finishRaw() {
            const raw = this.raw;
            this.raw = null;
            const source = raw.parts.join('').trim();
            if (!source) throw new SyntaxError('备份中存在空的 JSON 值');
            await raw.onValue(JSON.parse(source));
        }

        async consume(text) {
            let index = 0;
            while (index < text.length) {
                if (this.raw) {
                    const result = this.consumeRaw(text, index);
                    index = result.index;
                    if (!result.complete) return;
                    await this.finishRaw();
                    continue;
                }

                const character = text[index];
                if (/\s/.test(character) || (this.state === 'root-start' && character === '\uFEFF')) {
                    index++;
                    continue;
                }

                if (this.state === 'root-start') {
                    if (character !== '{') throw new SyntaxError('备份根节点必须是 JSON 对象');
                    this.state = 'root-key-or-end';
                    index++;
                } else if (this.state === 'root-key-or-end') {
                    if (character === '}') {
                        this.done = true;
                        this.state = 'done';
                        index++;
                    } else if (character === '"') {
                        this.startRaw(character, async value => {
                            this.rootKey = value;
                            this.state = 'root-colon';
                        });
                    } else {
                        throw new SyntaxError('备份字段名格式错误');
                    }
                } else if (this.state === 'root-colon') {
                    if (character !== ':') throw new SyntaxError(`备份字段 ${this.rootKey} 缺少冒号`);
                    this.state = 'root-value';
                    index++;
                } else if (this.state === 'root-value') {
                    if (this.streamArrays.has(this.rootKey) && character === '[') {
                        this.state = 'array-item-or-end';
                        index++;
                    } else if (this.streamObjects.has(this.rootKey) && character === '{') {
                        this.state = 'object-key-or-end';
                        index++;
                    } else {
                        const key = this.rootKey;
                        this.startRaw(character, async value => {
                            await this.handlers.onValue?.(key, value);
                            this.state = 'root-comma-or-end';
                        });
                    }
                } else if (this.state === 'root-comma-or-end') {
                    if (character === ',') {
                        this.state = 'root-key-or-end';
                        index++;
                    } else if (character === '}') {
                        this.done = true;
                        this.state = 'done';
                        index++;
                    } else {
                        throw new SyntaxError(`备份字段 ${this.rootKey} 后缺少分隔符`);
                    }
                } else if (this.state === 'array-item-or-end') {
                    if (character === ']') {
                        await this.handlers.onArrayEnd?.(this.rootKey);
                        this.state = 'root-comma-or-end';
                        index++;
                    } else {
                        const key = this.rootKey;
                        this.startRaw(character, async value => {
                            await this.handlers.onArrayItem?.(key, value);
                            this.state = 'array-comma-or-end';
                        });
                    }
                } else if (this.state === 'array-comma-or-end') {
                    if (character === ',') {
                        this.state = 'array-item-or-end';
                        index++;
                    } else if (character === ']') {
                        await this.handlers.onArrayEnd?.(this.rootKey);
                        this.state = 'root-comma-or-end';
                        index++;
                    } else {
                        throw new SyntaxError(`备份数组 ${this.rootKey} 缺少分隔符`);
                    }
                } else if (this.state === 'object-key-or-end') {
                    if (character === '}') {
                        await this.handlers.onObjectEnd?.(this.rootKey);
                        this.state = 'root-comma-or-end';
                        index++;
                    } else if (character === '"') {
                        this.startRaw(character, async value => {
                            this.objectKey = value;
                            this.state = 'object-colon';
                        });
                    } else {
                        throw new SyntaxError(`备份对象 ${this.rootKey} 的字段名格式错误`);
                    }
                } else if (this.state === 'object-colon') {
                    if (character !== ':') throw new SyntaxError(`备份字段 ${this.objectKey} 缺少冒号`);
                    this.state = 'object-value';
                    index++;
                } else if (this.state === 'object-value') {
                    const rootKey = this.rootKey;
                    const objectKey = this.objectKey;
                    this.startRaw(character, async value => {
                        await this.handlers.onObjectEntry?.(rootKey, objectKey, value);
                        this.state = 'object-comma-or-end';
                    });
                } else if (this.state === 'object-comma-or-end') {
                    if (character === ',') {
                        this.state = 'object-key-or-end';
                        index++;
                    } else if (character === '}') {
                        await this.handlers.onObjectEnd?.(this.rootKey);
                        this.state = 'root-comma-or-end';
                        index++;
                    } else {
                        throw new SyntaxError(`备份对象 ${this.rootKey} 缺少分隔符`);
                    }
                } else if (this.state === 'done') {
                    throw new SyntaxError('备份根对象后存在额外内容');
                }
            }
        }

        finish() {
            if (this.raw || !this.done) throw new SyntaxError('备份文件不完整');
        }
    }

    async function parse(file, handlers = {}) {
        const reader = openTextStream(file).then(stream => stream.getReader());
        const streamReader = await reader;
        const decoder = new TextDecoder();
        const parser = new TopLevelJsonParser(handlers);
        while (true) {
            const result = await streamReader.read();
            if (result.done) break;
            await parser.consume(decoder.decode(result.value, { stream: true }));
        }
        const tail = decoder.decode();
        if (tail) await parser.consume(tail);
        parser.finish();
    }

    window.UwULegacyBackupStream = { openTextStream, parse };
})();
