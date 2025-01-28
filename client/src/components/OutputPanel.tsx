interface OutputPanelProps {
  originalText: string;
  translatedText: string;
  onCopy: () => void;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ originalText, translatedText, onCopy }) => {
  return (
    <div className="w-full p-4">
      <div className="bg-white rounded-lg p-4 mb-4">
        <h3 className="font-bold mb-2">Translated Text:</h3>
        <p className="mb-4">{translatedText}</p>
        <h3 className="font-bold mb-2">Original Text:</h3>
        <p className="text-gray-600">{originalText}</p>
      </div>
      <button
        onClick={onCopy}
        className="w-full bg-green-500 text-white p-4 rounded-lg hover:bg-green-600"
      >
        Copy Result
      </button>
    </div>
  );
};

export default OutputPanel;