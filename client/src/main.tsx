import React, { useState } from 'react';
import InputPanel from './components/InputPanel/InputPanel';
import { translateText } from './utils/translator'

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleScramble = async () => {
    if (!inputText.trim() || isTranslating) return;
    
    setIsTranslating(true);
    let currentText = inputText;
    document.querySelector('section')?.classList.add('displayBothPanels')

    try {
      try {
        const translation = await translateText(
          'en',
          currentText,
          5
        )

        setOutputText(translation)
      } catch {
        console.log('Translation error =(')
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = outputText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  return (
    <div>
      <header>
        <h1>🌎 Whirld 🌏</h1>
        <p>Translate anything too many times!</p>
      </header>

      <main>
        <div>
          <InputPanel
            text={inputText}
            onChange={setInputText}
            onScramble={handleScramble}
            isTranslating={isTranslating}

            translatedText={outputText}
            onCopy={handleCopy}
          />
        </div>
      </main>
    </div>
  );
};

export default App;