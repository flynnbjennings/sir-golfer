
const WORKER_URL = 'https://sir-golfer-ai.flynnbjennings.workers.dev/';

// Main elements
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

// App state
let conversation = [];
let voiceMode = false;
let waitingForReply = false;
let recognitionActive = false;
let recognition = null;

// ----------------------------------
// Notifications
// ----------------------------------

function notify(text) {
  if (!toast) return;

  toast.textContent = text;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// ----------------------------------
// Voice selection
// ----------------------------------

function loadVoices() {
  if (!window.speechSynthesis || !voiceSelect) return;

  const voices = window.speechSynthesis.getVoices();
  const previousSelection = voiceSelect.value;

  voiceSelect.innerHTML = '';

  voices
    .filter(voice => voice.lang.startsWith('en'))
    .forEach(voice => {
      const option = document.createElement('option');

      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;

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

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// ----------------------------------
// Display chat messages
// ----------------------------------

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

  row.scrollIntoView({
    behavior: 'smooth',
    block: 'end'
  });

  return bubble;
}

// ----------------------------------
// Connect to Sir Golfer AI
// ----------------------------------

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
    console.log('Connecting to Sir Golfer AI...');

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: conversation
      })
    });

    console.log('Worker response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `AI Worker error (${response.status}): ${errorText}`
      );
    }

    const reply = await response.text();

    if (!reply.trim()) {
      throw new Error('The AI Worker returned an empty response.');
    }

    conversation.push({
      role: 'assistant',
      content: reply
    });

    if (!voiceMode) {
      addMessage(reply, 'assistant');
    } else {
      voiceStatus.textContent = 'Speaking...';
      speak(reply);
    }

    console.log('Sir Golfer replied successfully.');

  } catch (error) {
    console.error('Sir Golfer connection error:', error);

    conversation.pop();

    if (voiceMode) {
      waitingForReply = false;
      voiceStatus.textContent = 'Connection error. Please try again.';
    } else {
      addMessage(
        'Sorry, I could not connect to Sir Golfer AI. Please try again.',
        'assistant'
      );
    }
  }
}

// ----------------------------------
// Normal text chat
// ----------------------------------

form.addEventListener('submit', event => {
  event.preventDefault();
  send(input.value);
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';

  input.style.height =
    Math.min(input.scrollHeight, 130) + 'px';
});

// ----------------------------------
// Suggestion buttons
// ----------------------------------

document.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => {
    send(button.dataset.prompt);
  });
});

// ----------------------------------
// New conversation
// ----------------------------------

document.getElementById('newChat').addEventListener('click', () => {
  messages.innerHTML = '';
  conversation = [];

  welcome.style.display = 'block';
  input.focus();
});

// ----------------------------------
// Navigation buttons
// ----------------------------------

document.getElementById('calendarNav').addEventListener('click', () => {
  notify('Google Calendar connection is coming later.');
});

document.getElementById('tasksNav').addEventListener('click', () => {
  notify('Task management is coming later.');
});

// ----------------------------------
// Speech recognition
// ----------------------------------

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

function startListening() {
  if (!recognition) {
    notify('Voice recognition is not supported in this browser.');
    return;
  }

  if (recognitionActive || waitingForReply) return;

  try {
    recognition.start();
  } catch (error) {
    console.log('Could not start voice recognition:', error);
  }
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.lang = 'en-AU';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognitionActive = true;

    if (mic) {
      mic.classList.add('listening');
    }

    if (voiceMode) {
      voiceStatus.textContent = 'Listening...';
    } else {
      notify('Listening...');
    }
  };

  recognition.onend = () => {
    recognitionActive = false;

    if (mic) {
      mic.classList.remove('listening');
    }

    if (voiceMode && !waitingForReply) {
      setTimeout(() => {
        if (voiceMode && !waitingForReply && !recognitionActive) {
          startListening();
        }
      }, 500);
    }
  };

  recognition.onerror = event => {
    console.error('Speech recognition error:', event.error);

    recognitionActive = false;

    if (voiceMode) {
      voiceStatus.textContent = 'Microphone error. Please try again.';
    }
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;

    if (voiceMode) {
      waitingForReply = true;
      voiceStatus.textContent = 'Thinking...';
    }

    input.value = transcript;
    form.requestSubmit();
  };

} else {
  if (mic) {
    mic.addEventListener('click', () => {
      notify('Voice recognition is not supported in this browser.');
    });
  }
}

// ----------------------------------
// Normal microphone button
// ----------------------------------

mic.addEventListener('click', () => {
  if (!voiceMode) {
    startListening();
  }
});

// ----------------------------------
// Open voice mode
// ----------------------------------

voiceModeBtn.addEventListener('click', () => {
  voiceMode = true;
  waitingForReply = false;

  voiceScreen.classList.add('active');

  startListening();
});

// ----------------------------------
// Exit voice mode
// ----------------------------------

voiceExit.addEventListener('click', () => {
  voiceMode = false;
  waitingForReply = false;

  voiceScreen.classList.remove('active');

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  if (recognition && recognitionActive) {
    recognition.stop();
  }
});

// ----------------------------------
// Voice screen microphone
// ----------------------------------

voiceListenBtn.addEventListener('click', () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  waitingForReply = false;
  startListening();
});

// ----------------------------------
// Speak AI replies
// ----------------------------------

function speak(text) {
  if (!window.speechSynthesis) {
    voiceStatus.textContent = 'Speech is unavailable.';
    waitingForReply = false;
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

  message.onerror = event => {
    console.error('Speech output error:', event.error);

    if (voiceMode) {
      waitingForReply = false;
      voiceStatus.textContent = 'Tap the microphone to try again.';
    }
  };

  window.speechSynthesis.speak(message);
}

console.log('Sir Golfer app loaded successfully.');
