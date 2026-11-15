
const form = document.getElementById('chatForm');
const input = document.getElementById('messageInput');
const messages = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const mic = document.getElementById('micBtn');
const toast = document.getElementById('toast');

// Voice mode elements
const voiceModeBtn = document.getElementById('voiceModeBtn');
const voiceScreen = document.getElementById('voiceScreen');
const voiceExit = document.getElementById('voiceExit');
const voiceListenBtn = document.getElementById('voiceListenBtn');
const voiceStatus = document.getElementById('voiceStatus');
const voiceSelect = document.getElementById('voiceSelect');

let conversation = [];
let voiceMode = false;
let waitingForReply = false;
let recognitionActive = false;

// Load available voices
function loadVoices() {
  const voices = window.speechSynthesis.getVoices();

  const previousSelection = voiceSelect.value;
  voiceSelect.innerHTML = '';
  const preferredVoice = 'Samantha';

  voices
    .filter(voice => voice.lang.startsWith('en'))
    .forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = voice.name + ' (' + voice.lang + ')';
      voiceSelect.appendChild(option);
    });

 if (previousSelection) {
  voiceSelect.value = previousSelection;
} else {
  const samantha = voices.find(voice =>
    voice.name.includes('Samantha')
  );

  if (samantha) {
    voiceSelect.value = samantha.name;
  }
}
}

loadVoices();
window.speechSynthesis.onvoiceschanged = loadVoices;

// Notifications
function notify(text) {
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// Add chat message
function addMessage(text, who) {
  const row = document.createElement('div');
  row.className = 'message ' + who;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = who === 'user' ? 'YOU' : 'SG';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  row.append(avatar, bubble);
  messages.append(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// Send message to Sir Golfer
async function send(text) {
  const clean = text.trim();
  if (!clean) return;

  welcome.style.display = 'none';

  if (!voiceMode) {
    addMessage(clean, 'user');
  }

  input.value = '';
  input.style.height = 'auto';

  conversation.push({
    role: 'user',
    content: clean
  });

  if (voiceMode) {
    voiceStatus.textContent = 'Thinking...';
  } else {
    notify('Sir Golfer is thinking...');
  }

  try {
    const response = await fetch("https://sir-golfer-ai.flynnbjennings.workers.dev/", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: conversation
      })
    });

    if (!response.ok) {
      throw new Error(await response.text() || 'Something went wrong.');
    }

    let assistantBubble = null;

    if (!voiceMode) {
      addMessage('', 'assistant');
      assistantBubble =
        messages.lastElementChild.querySelector('.bubble');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let reply = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      reply += chunk;

      if (assistantBubble) {
        assistantBubble.textContent = reply;
      }
    }

    conversation.push({
      role: 'assistant',
      content: reply
    });

    if (voiceMode) {
      voiceStatus.textContent = 'Speaking...';
    }

    if (voiceMode) {
  speak(reply);
}

  } catch (error) {
    conversation.pop();

    if (voiceMode) {
      voiceStatus.textContent = 'Connection error';
      waitingForReply = false;
    } else {
      addMessage(
        'Sorry, I could not connect to my AI brain. Check that Ollama is running.',
        'assistant'
      );
    }

    console.error(error);
  }
}

// Normal text chat
form.addEventListener('submit', e => {
  e.preventDefault();
  send(input.value);
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height =
    Math.min(input.scrollHeight, 130) + 'px';
});

// Suggestion buttons
document.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => {
    send(button.dataset.prompt);
  });
});

// New conversation
document.getElementById('newChat').addEventListener('click', () => {
  messages.innerHTML = '';
  conversation = [];
  welcome.style.display = 'block';
  input.focus();
});

// Navigation buttons
document.getElementById('calendarNav').addEventListener('click', () => {
  notify('Google Calendar connection is a future step.');
});

document.getElementById('tasksNav').addEventListener('click', () => {
  notify('Task management is coming later.');
});

// Speech recognition
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

function startListening() {
  if (!recognition) {
    notify('Voice recognition is not supported in this browser.');
    return;
  }

  if (recognitionActive) return;

  try {
    recognition.start();
  } catch (error) {
    console.log('Recognition could not start:', error);
  }
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.lang = 'en-AU';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognitionActive = true;
    mic.classList.add('listening');

    if (voiceMode) {
      voiceStatus.textContent = 'Listening...';
    } else {
      notify('Listening...');
    }
  };

  recognition.onend = () => {
    recognitionActive = false;
    mic.classList.remove('listening');

    if (voiceMode && !waitingForReply) {
      startListening();
    }
  };

  recognition.onerror = () => {
    recognitionActive = false;
    mic.classList.remove('listening');

    if (voiceMode) {
      voiceStatus.textContent = 'Tap the microphone to try again';
    } else {
      notify('Voice input is unavailable.');
    }
  };

  recognition.onresult = e => {
    const transcript = e.results[0][0].transcript;

    if (voiceMode) {
      waitingForReply = true;
      voiceStatus.textContent = 'Thinking...';
    }

    input.value = transcript;
    form.requestSubmit();
  };

} else {
  mic.addEventListener('click', () => {
    notify('Voice input is not supported in this browser.');
  });
}

// Normal microphone button
mic.addEventListener('click', () => {
  if (!voiceMode) {
    startListening();
  }
});

// Open voice mode
voiceModeBtn.addEventListener('click', () => {
  voiceMode = true;
  waitingForReply = false;

  voiceScreen.classList.add('active');
  startListening();
});

// Exit voice mode
voiceExit.addEventListener('click', () => {
  voiceMode = false;
  waitingForReply = false;

  voiceScreen.classList.remove('active');

  window.speechSynthesis.cancel();

  if (recognition && recognitionActive) {
    recognition.stop();
  }
});

// Voice screen microphone
voiceListenBtn.addEventListener('click', () => {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  waitingForReply = false;
  startListening();
});

// Spoken replies using selected voice
function speak(text) {
  if (!('speechSynthesis' in window)) {
    if (voiceMode) {
      voiceStatus.textContent = 'Speech is unavailable';
    }
    return;
  }

  window.speechSynthesis.cancel();

  const message = new SpeechSynthesisUtterance(text);

  message.lang = 'en-AU';
  message.rate = 1.05;
  message.pitch = 0.95;

  const voices = window.speechSynthesis.getVoices();

  const selectedVoice = voices.find(voice =>
    voice.name === voiceSelect.value
  );

  if (selectedVoice) {
    message.voice = selectedVoice;
  }

  message.onend = () => {
    if (voiceMode) {
      waitingForReply = false;
      voiceStatus.textContent = 'Ready when you are';
      startListening();
    }
  };

  message.onerror = () => {
    if (voiceMode) {
      voiceStatus.textContent = 'Tap the microphone to try again';
      waitingForReply = false;
    }
  };

  window.speechSynthesis.speak(message);
}
