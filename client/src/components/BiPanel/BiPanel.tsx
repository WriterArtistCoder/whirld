import React from 'react';
import './BiPanel.css';

interface BiPanelProps {
  inputText: string;
  outputText: string;
  logText: string;

  onChange: (text: string) => void;
  onScramble: () => void;
  onCopy: () => void;
  
  isTranslating: boolean;
  bothPanels: boolean;
}

const BiPanel: React.FC<BiPanelProps> = ({ inputText,  outputText, logText, onChange, onScramble, isTranslating, bothPanels, onCopy }) => {
  return (
    <section className={(isTranslating ? "isTranslating" : "") + (bothPanels ? " displayBothPanels" : "")}>
      <textarea
        className="inputPanel biPanel"
        readOnly={isTranslating}
        value={inputText}
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
        value={outputText}
     // onWheel="document.querySelector('.inputPanel')?.scrollTop? = this.scrollTop || 0}"
      />
      <button
        className="outputButton"
        disabled={isTranslating}
        onClick={onCopy}
      >
        Copy
      </button>

      <div className="logPanel">
        {logText}
      </div>
    </section>
  );
};

export default BiPanel;