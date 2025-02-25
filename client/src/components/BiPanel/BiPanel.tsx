import React from 'react';
import './BiPanel.css';

interface BiPanelProps {
  text: string;
  onChange: (text: string) => void;
  onScramble: () => void;
  isTranslating: boolean;

  translatedText: string;
  onCopy: () => void;
}

const BiPanel: React.FC<BiPanelProps> = ({ text, onChange, onScramble, isTranslating, translatedText, onCopy }) => {
  return (
    <section>
      <textarea
        className="inputPanel biPanel"
        readOnly={isTranslating}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type in a song, speech, or other text here!"
      />

      <button
      className='inputButton'
        onClick={onScramble}
        disabled={isTranslating}
      >
        {isTranslating ? 'Translating...' : 'Scramble'}
      </button>

      <textarea
        // className={styles.outputPanel}
        className="outputPanel biPanel"
        readOnly
        value={translatedText}
      />
      <button
      className='outputButton'
      onClick={onCopy}
      >
        Copy
      </button>
    </section>
  );
};

export default BiPanel;