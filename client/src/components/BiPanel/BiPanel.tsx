import React from 'react';
import './BiPanel.css';

interface BiPanelProps {
  text: string;
  onChange: (text: string) => void;
  onScramble: () => void;
  isTranslating: boolean;
  bothPanels: boolean;

  translatedText: string;
  onCopy: () => void;
}

const BiPanel: React.FC<BiPanelProps> = ({ text, onChange, onScramble, isTranslating, bothPanels, translatedText, onCopy }) => {
  return (
    <section className={(isTranslating ? "isTranslating" : "") + (bothPanels ? " displayBothPanels" : "")}>
      <textarea
        className="inputPanel biPanel"
        readOnly={isTranslating}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type in a song, speech, or other text here!"
      />

      <button
        className="inputButton"
        onClick={onScramble}
        disabled={isTranslating}
      >
        {isTranslating ? 'Translating...' : 'Scramble'}
      </button>

      <textarea
        className="outputPanel biPanel"
        readOnly
        value={translatedText}
        // onWheel="document.querySelector('.inputPanel')?.scrollTop? = this.scrollTop || 0}"
      />
      <button
        className="outputButton"
        disabled={isTranslating}
        onClick={onCopy}
      >
        Copy
      </button>
    </section>
  );
};

export default BiPanel;