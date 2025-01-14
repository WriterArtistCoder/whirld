interface InputPanelProps {
  text: string;
  onChange: (text: string) => void;
  onScramble: () => void;
  isTranslating: boolean;
}

const InputPanel: React.FC<InputPanelProps> = ({ text, onChange, onScramble, isTranslating }) => {
  return (
    <div className="w-full p-4">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type in a sentence, song or political speech here!"
        className="w-full h-48 p-4 rounded-lg border focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={onScramble}
        disabled={isTranslating}
        className="w-full mt-4 bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {isTranslating ? 'Translating...' : 'Scramble'}
      </button>
    </div>
  );
};

export default InputPanel;