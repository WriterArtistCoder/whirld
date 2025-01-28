import './InputPanel.module.css';

interface InputPanelProps {
  text: string;
  onChange: (text: string) => void;
  onScramble: () => void;
  isTranslating: boolean;
}

const InputPanel: React.FC<InputPanelProps> = ({ text, onChange, onScramble, isTranslating }) => {
  return (
    <section>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type in a song, speech, or other text here!"
      />
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type in a song, speech, or other text here!"
      />
      <button
        onClick={onScramble}
        disabled={isTranslating}
      >
        {isTranslating ? 'Translating...' : 'Scramble'}
      </button>
    </section>
  );
};

export default InputPanel;