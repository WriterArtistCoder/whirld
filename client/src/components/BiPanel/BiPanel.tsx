import React from 'react';
import './BiPanel.css';

interface BiPanelProps {
  inputText: string;
  outputText: string;
  logText: string;

  onChange: (text: string) => void;
  onScramble: () => void;
  onCopy: () => void;

  copied: boolean;
  copyRaw: boolean;
  wasError: boolean;
  isTranslating: boolean;
  funBegun: boolean;
}

const BiPanel: React.FC<BiPanelProps> = ({ inputText, outputText, logText, onChange, onScramble, isTranslating, funBegun, onCopy, copied, copyRaw, wasError }) => {
  return (
    <section className={(isTranslating ? "isTranslating" : "") + (funBegun ? " funBegun" : "")}>
      {/* <div className="inputLang">
        🌏
      </div> TODO Finish lang selector */}

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
        {isTranslating ? 'Translating...' : funBegun ? 'Scramble more!' : 'Scramble'}
      </button>

      <textarea
        className={("outputPanel biPanel") + (copied ? " outputCopied" : "") + (wasError ? " outputError" : "")}
        readOnly
        value={outputText}
     // onWheel="document.querySelector('.inputPanel')?.scrollTop? = this.scrollTop || 0}"
      />
      <button
        className="outputButton"
        disabled={isTranslating || wasError}
        onClick={onCopy}
      >
        {copyRaw ? 'Copy raw text' : 'Copy fancy text'}
      </button>

      <div className="logPanel">
        {logText}
      </div>
    </section>
  );
};

export default BiPanel;