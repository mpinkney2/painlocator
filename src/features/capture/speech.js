function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  state.recognition = new SR();
  state.recognition.lang = 'en-US';
  state.recognition.interimResults = false;
  state.recognition.onstart = () => document.getElementById('btnMic').classList.add('recording');
  state.recognition.onresult = e => {
    document.getElementById('notesInput').value = e.results[0][0].transcript;
    syncFormToActiveEntry();
  };
  state.recognition.onerror = () => document.getElementById('btnMic').classList.remove('recording');
  state.recognition.onend = () => document.getElementById('btnMic').classList.remove('recording');
}

function toggleMic() {
  if (!state.recognition) { alert('Speech dictation is not supported in this browser.'); return; }
  const btn = document.getElementById('btnMic');
  if (btn.classList.contains('recording')) state.recognition.stop();
  else state.recognition.start();
}

// ==========================================================================
