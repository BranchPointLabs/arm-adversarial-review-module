export function safeSpeechCancel() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // WebView speech support is optional; transcript and cards are durable.
  }
}

export function safeSpeechPause() {
  try {
    window.speechSynthesis?.pause();
  } catch {
    // Playback failure should not affect saved review output.
  }
}

export function safeSpeechResume() {
  try {
    window.speechSynthesis?.resume();
  } catch {
    // Playback failure should not affect saved review output.
  }
}

export function safeSpeechSpeak(utterance: SpeechSynthesisUtterance) {
  try {
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
