// src/generators/qa-widget/inject.ts
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// src/generators/qa-widget/widget.ts
function generateWidgetJS(config) {
  return `
(function() {
  'use strict';

  var ENDPOINT = ${JSON.stringify(config.apiEndpoint)};
  var SEARCH_INDEX_URL = ${JSON.stringify(config.searchIndexUrl)};
  var POSITION = ${JSON.stringify(config.position)};
  var GREETING = ${JSON.stringify(config.greeting)};
  var DAILY_LIMIT = ${config.dailyLimit};
  var MODE = ${JSON.stringify(config.mode)};
  var STORAGE_KEY = 'docwalk-qa-count';
  var MAX_HISTORY = 6;
  var TOP_K = 5;

  // \u2500\u2500 State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var searchIndex = null;
  var indexLoading = false;
  var conversationHistory = [];
  var isStreaming = false;

  // \u2500\u2500 Daily Limit \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function getQuestionsToday() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return 0;
      var data = JSON.parse(stored);
      var today = new Date().toISOString().slice(0, 10);
      return data.date === today ? data.count : 0;
    } catch(e) { return 0; }
  }

  function incrementQuestions() {
    var today = new Date().toISOString().slice(0, 10);
    var count = getQuestionsToday() + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: count }));
  }

  // \u2500\u2500 HTML Sanitization \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Allowlist-based sanitizer for rendered markdown.
  // Only allows safe tags/attributes \u2014 strips everything else.
  var SAFE_TAGS = new Set(['strong','em','code','pre','a','br','ul','ol','li','p','span']);
  var SAFE_ATTRS = { a: new Set(['href','target','rel','class']), pre: new Set(['class']), code: new Set(['class']), span: new Set(['class']), div: new Set(['class']) };

  function sanitizeHtml(html) {
    var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    var root = doc.body.firstChild;
    if (!root) return '';
    sanitizeNode(root);
    return root.innerHTML;
  }

  function sanitizeNode(node) {
    var children = Array.from(node.childNodes);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === 3) continue; // text node \u2014 safe
      if (child.nodeType !== 1) { child.remove(); continue; }
      var tag = child.tagName.toLowerCase();
      if (!SAFE_TAGS.has(tag)) {
        // Replace unsafe element with its text content
        var text = document.createTextNode(child.textContent || '');
        child.parentNode.replaceChild(text, child);
        continue;
      }
      // Strip unsafe attributes
      var allowed = SAFE_ATTRS[tag] || new Set();
      var attrs = Array.from(child.attributes);
      for (var a = 0; a < attrs.length; a++) {
        if (!allowed.has(attrs[a].name)) child.removeAttribute(attrs[a].name);
      }
      // For links, enforce safe href (no javascript:)
      if (tag === 'a') {
        var href = child.getAttribute('href') || '';
        if (href.toLowerCase().trim().startsWith('javascript')) {
          child.removeAttribute('href');
        }
        child.setAttribute('rel', 'noopener noreferrer');
      }
      sanitizeNode(child);
    }
  }

  // \u2500\u2500 BM25 Client-Side Search \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var STOP = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","this","that","these","those","it","its","not","no","so","if","as","up","out","about","into","over","after","then","than","also"]);

  function tokenize(text) {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(function(t) { return t.length > 1 && !STOP.has(t); });
  }

  function bm25Search(index, query) {
    var tokens = tokenize(query);
    if (!tokens.length || !index.chunks.length) return [];

    var N = index.chunks.length;
    var k1 = 1.2, b = 0.75;
    var scores = new Array(N).fill(0);

    for (var t = 0; t < tokens.length; t++) {
      var entry = index.terms[tokens[t]];
      if (!entry || !entry.postings) continue;
      var idf = Math.log((N - entry.df + 0.5) / (entry.df + 0.5) + 1);
      for (var p = 0; p < entry.postings.length; p++) {
        var post = entry.postings[p];
        var dl = index.chunks[post.chunkIdx].tokenCount;
        var tfNorm = (post.tf * (k1 + 1)) / (post.tf + k1 * (1 - b + b * dl / index.avgDl));
        scores[post.chunkIdx] += idf * tfNorm;
      }
    }

    var results = [];
    for (var i = 0; i < N; i++) {
      if (scores[i] > 0) results.push({ idx: i, score: scores[i] });
    }
    results.sort(function(a, b) { return b.score - a.score; });
    return results.slice(0, TOP_K).map(function(r) { return index.chunks[r.idx]; });
  }

  async function loadSearchIndex() {
    if (searchIndex || indexLoading) return searchIndex;
    indexLoading = true;
    try {
      var res = await fetch(SEARCH_INDEX_URL);
      if (!res.ok) throw new Error('Failed to load search index');
      searchIndex = await res.json();
      return searchIndex;
    } catch(e) {
      console.warn('DocWalk Q&A: Could not load search index', e);
      return null;
    } finally {
      indexLoading = false;
    }
  }

  // \u2500\u2500 Simple Markdown Rendering (output is sanitized) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderMarkdown(text) {
    var html = escapeHtml(text)
      // Code blocks (must be before inline code)
      .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, function(m, code) {
        return '<pre class="dw-qa-code">' + code + '</pre>';
      })
      // Inline code
      .replace(/\`([^\`]+)\`/g, '<code class="dw-qa-inline-code">$1</code>')
      // Bold
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
      // Line breaks (double newline = paragraph break)
      .replace(/\\n\\n/g, '<br><br>')
      .replace(/\\n/g, '<br>');
    return sanitizeHtml(html);
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // \u2500\u2500 SSE Streaming \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  async function streamAnswer(question, chunks, onToken, onDone, onError) {
    var body = {
      question: question,
      chunks: chunks.map(function(c) {
        return { content: c.content, pagePath: c.pagePath, pageTitle: c.pageTitle, heading: c.heading };
      }),
      history: conversationHistory.slice(-MAX_HISTORY)
    };

    try {
      var res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        var errData = await res.json().catch(function() { return { error: 'Request failed' }; });
        onError(errData.error || 'Request failed (' + res.status + ')');
        return;
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var fullText = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith('data: ')) continue;
          var data = line.slice(6);
          try {
            var parsed = JSON.parse(data);
            if (parsed.done) {
              onDone(fullText, parsed.citations || []);
              return;
            }
            if (parsed.token) {
              fullText += parsed.token;
              onToken(parsed.token, fullText);
            }
          } catch(e) {}
        }
      }

      if (fullText) onDone(fullText, []);
    } catch(e) {
      onError(e.message || 'Network error');
    }
  }

  // \u2500\u2500 Widget DOM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function createWidget() {
    var container = document.createElement('div');
    container.id = 'docwalk-qa-widget';

    var toggle = document.createElement('button');
    toggle.id = 'dw-qa-toggle';
    toggle.setAttribute('aria-label', 'Ask a question');
    toggle.title = 'Ask about this project';
    toggle.textContent = '';
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
    svg.appendChild(path);
    toggle.appendChild(svg);
    container.appendChild(toggle);

    var panel = document.createElement('div');
    panel.id = 'dw-qa-panel';
    panel.style.display = 'none';

    // Header
    var header = document.createElement('div');
    header.id = 'dw-qa-header';
    var titleSpan = document.createElement('span');
    titleSpan.className = 'dw-qa-title';
    titleSpan.textContent = 'Ask about this project';
    header.appendChild(titleSpan);

    var actions = document.createElement('div');
    actions.className = 'dw-qa-header-actions';
    var newBtn = document.createElement('button');
    newBtn.id = 'dw-qa-new';
    newBtn.setAttribute('aria-label', 'New conversation');
    newBtn.title = 'New conversation';
    newBtn.textContent = '+';
    var closeBtn = document.createElement('button');
    closeBtn.id = 'dw-qa-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\\u00d7';
    actions.appendChild(newBtn);
    actions.appendChild(closeBtn);
    header.appendChild(actions);
    panel.appendChild(header);

    // Messages
    var messagesDiv = document.createElement('div');
    messagesDiv.id = 'dw-qa-messages';
    var greetingDiv = document.createElement('div');
    greetingDiv.className = 'dw-qa-msg dw-qa-bot';
    greetingDiv.textContent = GREETING;
    messagesDiv.appendChild(greetingDiv);
    panel.appendChild(messagesDiv);

    // Input area
    var inputArea = document.createElement('div');
    inputArea.id = 'dw-qa-input-area';
    var input = document.createElement('input');
    input.id = 'dw-qa-input';
    input.type = 'text';
    input.placeholder = 'Type your question...';
    input.autocomplete = 'off';
    inputArea.appendChild(input);
    var sendBtn = document.createElement('button');
    sendBtn.id = 'dw-qa-send';
    sendBtn.setAttribute('aria-label', 'Send');
    var sendSvg = document.createElementNS(svgNS, 'svg');
    sendSvg.setAttribute('width', '18');
    sendSvg.setAttribute('height', '18');
    sendSvg.setAttribute('viewBox', '0 0 24 24');
    sendSvg.setAttribute('fill', 'currentColor');
    var sendPath = document.createElementNS(svgNS, 'path');
    sendPath.setAttribute('d', 'M2 21l21-9L2 3v7l15 2-15 2z');
    sendSvg.appendChild(sendPath);
    sendBtn.appendChild(sendSvg);
    inputArea.appendChild(sendBtn);
    panel.appendChild(inputArea);
    container.appendChild(panel);

    document.body.appendChild(container);

    // Toggle panel
    toggle.addEventListener('click', function() {
      panel.style.display = 'flex';
      toggle.style.display = 'none';
      input.focus();
      if (MODE === 'client' && !searchIndex) loadSearchIndex();
    });

    closeBtn.addEventListener('click', function() {
      panel.style.display = 'none';
      toggle.style.display = 'flex';
    });

    newBtn.addEventListener('click', function() {
      conversationHistory = [];
      messagesDiv.textContent = '';
      var g = document.createElement('div');
      g.className = 'dw-qa-msg dw-qa-bot';
      g.textContent = GREETING;
      messagesDiv.appendChild(g);
      input.focus();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panel.style.display !== 'none') {
        panel.style.display = 'none';
        toggle.style.display = 'flex';
      }
    });

    function addMessage(content, isUser, className) {
      var div = document.createElement('div');
      div.className = 'dw-qa-msg ' + (isUser ? 'dw-qa-user' : 'dw-qa-bot') + (className ? ' ' + className : '');
      if (isUser) {
        div.textContent = content;
      } else {
        // Bot messages use sanitized HTML rendering
        var sanitized = sanitizeHtml(content);
        var temp = document.createElement('div');
        temp.innerHTML = sanitized;
        while (temp.firstChild) div.appendChild(temp.firstChild);
      }
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return div;
    }

    function addCitations(citations) {
      if (!citations || !citations.length) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'dw-qa-citations';
      var label = document.createElement('span');
      label.className = 'dw-qa-citations-label';
      label.textContent = 'Sources: ';
      wrapper.appendChild(label);
      for (var i = 0; i < citations.length; i++) {
        var a = document.createElement('a');
        a.className = 'dw-qa-citation-link';
        a.href = citations[i].pagePath;
        a.textContent = citations[i].pageTitle;
        a.setAttribute('rel', 'noopener');
        wrapper.appendChild(a);
        if (i < citations.length - 1) {
          var sep = document.createTextNode(' \\u00b7 ');
          wrapper.appendChild(sep);
        }
      }
      messagesDiv.appendChild(wrapper);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function setInputEnabled(enabled) {
      input.disabled = !enabled;
      sendBtn.disabled = !enabled;
      if (enabled) input.focus();
    }

    async function askQuestion() {
      var question = input.value.trim();
      if (!question || isStreaming) return;

      if (getQuestionsToday() >= DAILY_LIMIT) {
        addMessage('Daily question limit reached (' + DAILY_LIMIT + '/day). Run DocWalk locally for unlimited Q&A.', false);
        return;
      }

      addMessage(question, true);
      input.value = '';
      setInputEnabled(false);
      isStreaming = true;

      var chunks = [];
      if (MODE === 'client') {
        var index = searchIndex || await loadSearchIndex();
        if (index) {
          chunks = bm25Search(index, question);
        }
      }

      if (chunks.length === 0 && MODE === 'client') {
        addMessage('I could not find relevant documentation to answer your question. Try rephrasing or check the docs navigation.', false);
        setInputEnabled(true);
        isStreaming = false;
        return;
      }

      // Create streaming message element
      var streamDiv = document.createElement('div');
      streamDiv.className = 'dw-qa-msg dw-qa-bot dw-qa-streaming';
      var textSpan = document.createElement('span');
      var cursor = document.createElement('span');
      cursor.className = 'dw-qa-cursor';
      streamDiv.appendChild(textSpan);
      streamDiv.appendChild(cursor);
      messagesDiv.appendChild(streamDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

      conversationHistory.push({ role: 'user', content: question });

      await streamAnswer(
        question,
        chunks,
        function(token, fullText) {
          // Render incrementally with sanitization
          var rendered = renderMarkdown(fullText);
          var temp = document.createElement('div');
          temp.innerHTML = rendered;
          textSpan.textContent = '';
          while (temp.firstChild) textSpan.appendChild(temp.firstChild);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        },
        function(fullText, citations) {
          streamDiv.classList.remove('dw-qa-streaming');
          if (cursor.parentNode) cursor.remove();
          var rendered = renderMarkdown(fullText);
          var temp = document.createElement('div');
          temp.innerHTML = rendered;
          textSpan.textContent = '';
          while (temp.firstChild) textSpan.appendChild(temp.firstChild);
          addCitations(citations);
          conversationHistory.push({ role: 'assistant', content: fullText });
          if (conversationHistory.length > MAX_HISTORY) {
            conversationHistory = conversationHistory.slice(-MAX_HISTORY);
          }
          incrementQuestions();
          setInputEnabled(true);
          isStreaming = false;
        },
        function(error) {
          streamDiv.classList.remove('dw-qa-streaming');
          if (cursor.parentNode) cursor.remove();
          textSpan.textContent = 'Sorry, something went wrong: ' + error;
          streamDiv.classList.add('dw-qa-error');
          setInputEnabled(true);
          isStreaming = false;
        }
      );
    }

    sendBtn.addEventListener('click', askQuestion);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        askQuestion();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
`;
}

// src/generators/qa-widget/inject.ts
var DEFAULT_QA_ENDPOINT = "https://docwalk-ai-proxy.jonathanrannabargar.workers.dev/v1/qa/stream";
var WIDGET_CSS = `/* DocWalk Q&A Widget */

#docwalk-qa-widget {
  --dw-accent: var(--md-accent-fg-color, #5de4c7);
  --dw-accent-t: var(--md-accent-fg-color--transparent, rgba(93,228,199,0.1));
  --dw-bg: var(--md-default-bg-color, #16161a);
  --dw-bg-alt: var(--md-code-bg-color, #1c1c22);
  --dw-fg: var(--md-default-fg-color, #e8e6e3);
  --dw-fg-muted: var(--md-default-fg-color--light, #6a6a6e);
  --dw-border: var(--md-default-fg-color--lightest, #2a2a32);
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
}

/* Toggle button */
#docwalk-qa-widget #dw-qa-toggle {
  all: unset;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--dw-accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  transition: transform 0.2s, box-shadow 0.2s;
}
#docwalk-qa-widget #dw-qa-toggle svg { filter: brightness(0); }
#docwalk-qa-widget #dw-qa-toggle:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
}

/* Panel */
#docwalk-qa-widget #dw-qa-panel {
  display: none;
  flex-direction: column;
  width: 400px;
  max-width: calc(100vw - 40px);
  height: 520px;
  max-height: calc(100vh - 100px);
  background: var(--dw-bg);
  border: 1px solid var(--dw-border);
  border-radius: 12px;
  box-shadow: 0 8px 48px rgba(0,0,0,0.35);
  overflow: hidden;
  color: var(--dw-fg);
}

/* Header */
#docwalk-qa-widget #dw-qa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--dw-bg-alt);
  border-bottom: 1px solid var(--dw-border);
}
#docwalk-qa-widget .dw-qa-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--dw-fg);
  letter-spacing: -0.01em;
}
#docwalk-qa-widget .dw-qa-header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
#docwalk-qa-widget #dw-qa-new,
#docwalk-qa-widget #dw-qa-close {
  all: unset;
  box-sizing: border-box;
  color: var(--dw-fg-muted);
  cursor: pointer;
  font-size: 18px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}
#docwalk-qa-widget #dw-qa-new:hover,
#docwalk-qa-widget #dw-qa-close:hover {
  color: var(--dw-fg);
  background: var(--dw-accent-t);
}

/* Messages */
#docwalk-qa-widget #dw-qa-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
#docwalk-qa-widget .dw-qa-msg {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.65;
  max-width: 88%;
  word-wrap: break-word;
  animation: dw-qa-fadein 0.2s ease;
}
@keyframes dw-qa-fadein {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
#docwalk-qa-widget .dw-qa-user {
  background: var(--dw-accent);
  color: #000;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
  font-weight: 500;
}
#docwalk-qa-widget .dw-qa-bot {
  background: var(--dw-bg-alt);
  color: var(--dw-fg);
  align-self: flex-start;
  border-bottom-left-radius: 4px;
  border: 1px solid var(--dw-border);
}
#docwalk-qa-widget .dw-qa-bot strong { color: var(--dw-fg); }
#docwalk-qa-widget .dw-qa-bot a { color: var(--dw-accent); text-decoration: none; }
#docwalk-qa-widget .dw-qa-bot a:hover { text-decoration: underline; }

/* Streaming cursor */
#docwalk-qa-widget .dw-qa-streaming .dw-qa-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--dw-accent);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: dw-qa-blink 0.8s infinite;
}
@keyframes dw-qa-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Error */
#docwalk-qa-widget .dw-qa-error {
  border-color: #ef4444 !important;
  color: #fca5a5 !important;
}

/* Code in bot messages */
#docwalk-qa-widget .dw-qa-code {
  background: var(--md-code-bg-color, #111115);
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 8px 0;
  font-family: var(--md-code-font-family, 'Fira Code', monospace);
  font-size: 12px;
  overflow-x: auto;
  white-space: pre;
  color: var(--dw-fg);
}
#docwalk-qa-widget .dw-qa-inline-code {
  background: var(--dw-accent-t);
  color: var(--dw-accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--md-code-font-family, 'Fira Code', monospace);
  font-size: 0.88em;
}

/* Citations */
#docwalk-qa-widget .dw-qa-citations {
  padding: 8px 14px;
  font-size: 11.5px;
  color: var(--dw-fg-muted);
  animation: dw-qa-fadein 0.3s ease;
}
#docwalk-qa-widget .dw-qa-citations-label {
  font-weight: 600;
  color: var(--dw-fg);
}
#docwalk-qa-widget .dw-qa-citation-link {
  color: var(--dw-accent);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.15s;
}
#docwalk-qa-widget .dw-qa-citation-link:hover {
  opacity: 1;
  text-decoration: underline;
}

/* Input area */
#docwalk-qa-widget #dw-qa-input-area {
  display: flex;
  padding: 12px;
  gap: 8px;
  border-top: 1px solid var(--dw-border);
  background: var(--dw-bg-alt);
  align-items: center;
}
#docwalk-qa-widget #dw-qa-input {
  all: unset;
  box-sizing: border-box;
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--dw-bg);
  color: var(--dw-fg);
  font-size: 13.5px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 0;
}
#docwalk-qa-widget #dw-qa-input:focus {
  border-color: var(--dw-accent);
  box-shadow: 0 0 0 2px var(--dw-accent-t);
}
#docwalk-qa-widget #dw-qa-input::placeholder {
  color: var(--dw-fg-muted);
}
#docwalk-qa-widget #dw-qa-input:disabled {
  opacity: 0.5;
}
#docwalk-qa-widget #dw-qa-send {
  all: unset;
  box-sizing: border-box;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--dw-accent);
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, transform 0.15s;
  flex-shrink: 0;
}
#docwalk-qa-widget #dw-qa-send:hover {
  opacity: 0.85;
  transform: scale(1.04);
}
#docwalk-qa-widget #dw-qa-send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none;
}

/* Scrollbar */
#docwalk-qa-widget #dw-qa-messages::-webkit-scrollbar { width: 4px; }
#docwalk-qa-widget #dw-qa-messages::-webkit-scrollbar-track { background: transparent; }
#docwalk-qa-widget #dw-qa-messages::-webkit-scrollbar-thumb {
  background: var(--dw-border);
  border-radius: 2px;
}

/* Mobile */
@media (max-width: 480px) {
  #docwalk-qa-widget { bottom: 10px; right: 10px; left: 10px; }
  #docwalk-qa-widget #dw-qa-panel {
    width: calc(100vw - 20px);
    height: calc(100vh - 80px);
    position: fixed;
    bottom: 10px;
    right: 10px;
    left: 10px;
  }
  #docwalk-qa-widget #dw-qa-toggle { width: 48px; height: 48px; }
}`;
async function injectQAWidget(outputDir, config, qaApiEndpoint) {
  const assetsDir = path.join(outputDir, "docs", "_docwalk");
  await mkdir(assetsDir, { recursive: true });
  const widgetJS = generateWidgetJS({
    apiEndpoint: qaApiEndpoint || DEFAULT_QA_ENDPOINT,
    searchIndexUrl: "_docwalk/qa-search.json",
    position: config.position || "bottom-right",
    greeting: config.greeting || "Ask me anything about this project.",
    dailyLimit: config.daily_limit || 50,
    mode: "client"
  });
  await writeFile(path.join(assetsDir, "qa-widget.js"), widgetJS);
  await writeFile(path.join(assetsDir, "qa-widget.css"), WIDGET_CSS);
  return {
    extraCss: ["_docwalk/qa-widget.css"],
    extraJs: ["_docwalk/qa-widget.js"]
  };
}
export {
  injectQAWidget
};
