'use client';

type SpeechButtonProps = {
  text: string;
};

export default function SpeechButton({ text }: SpeechButtonProps) {
  const speak = () => {
    const synth = window.speechSynthesis;

    if (!synth) return alert("La synthèse vocale n'est pas prise en charge");

    const utter = new SpeechSynthesisUtterance(text);

    // Tu peux personnaliser la voix ici
    utter.lang = 'fr-FR';
    utter.rate = 1; // vitesse
    utter.pitch = 1; // tonalité
    utter.volume = 1;

    synth.speak(utter);
  };

  return (
    <button
      onClick={speak}
      className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
    >
      🔊 Écouter
    </button>
  );
}
