/**
 * Q&A Widget — Client-Side JavaScript
 *
 * Generates the JS code for the chat widget that embeds
 * into generated MkDocs Material docs.
 */

export function generateWidgetJS(config: {
  apiEndpoint: string;
  position: "bottom-right" | "bottom-left";
  greeting: string;
  dailyLimit: number;
}): string {
  return `
(function() {
  'use strict';

  var ENDPOINT = ${JSON.stringify(config.apiEndpoint)};
  var POSITION = ${JSON.stringify(config.position)};
  var GREETING = ${JSON.stringify(config.greeting)};
  var DAILY_LIMIT = ${config.dailyLimit};
  var STORAGE_KEY = 'docwalk-qa-count';

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
    return count;
  }

  function createWidget() {
    var container = document.createElement('div');
    container.id = 'docwalk-qa-widget';
    container.innerHTML = \`
      <button id="dw-qa-toggle" aria-label="Ask a question">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div id="dw-qa-panel" style="display:none">
        <div id="dw-qa-header">
          <span>Ask about this project</span>
          <button id="dw-qa-close" aria-label="Close">&times;</button>
        </div>
        <div id="dw-qa-messages">
          <div class="dw-qa-msg dw-qa-bot">\${GREETING}</div>
        </div>
        <div id="dw-qa-input-area">
          <input id="dw-qa-input" type="text" placeholder="Type your question..." />
          <button id="dw-qa-send" aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    \`;

    document.body.appendChild(container);

    var toggle = document.getElementById('dw-qa-toggle');
    var panel = document.getElementById('dw-qa-panel');
    var close = document.getElementById('dw-qa-close');
    var input = document.getElementById('dw-qa-input');
    var send = document.getElementById('dw-qa-send');
    var messages = document.getElementById('dw-qa-messages');

    toggle.addEventListener('click', function() {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      toggle.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      if (panel.style.display !== 'none') input.focus();
    });

    close.addEventListener('click', function() {
      panel.style.display = 'none';
      toggle.style.display = 'flex';
    });

    function addMessage(text, isUser) {
      var div = document.createElement('div');
      div.className = 'dw-qa-msg ' + (isUser ? 'dw-qa-user' : 'dw-qa-bot');
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function askQuestion() {
      var question = input.value.trim();
      if (!question) return;

      if (getQuestionsToday() >= DAILY_LIMIT) {
        addMessage('Daily question limit reached. Upgrade to Team for unlimited Q&A.', false);
        return;
      }

      addMessage(question, true);
      input.value = '';
      input.disabled = true;
      send.disabled = true;

      addMessage('Thinking...', false);

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question, page: window.location.pathname })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        messages.removeChild(messages.lastChild); // Remove "Thinking..."
        addMessage(data.answer || 'Sorry, I could not find an answer.', false);
        if (data.citations && data.citations.length > 0) {
          addMessage('Sources: ' + data.citations.join(', '), false);
        }
        incrementQuestions();
      })
      .catch(function() {
        messages.removeChild(messages.lastChild);
        addMessage('Sorry, something went wrong. Please try again.', false);
      })
      .finally(function() {
        input.disabled = false;
        send.disabled = false;
        input.focus();
      });
    }

    send.addEventListener('click', askQuestion);
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') askQuestion();
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
