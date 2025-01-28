import React, { useState } from 'react';
import InputPanel from './components/InputPanel/InputPanel';
import OutputPanel from './components/OutputPanel';
// import { getRandomLanguage, translateText } from './utils/translator'
import { GoogleTranslate } from './GoogleCloud/GoogleTranslate'

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  
  const translator = new GoogleTranslate();

  const handleScramble = async () => {
    if (!inputText.trim() || isTranslating) return;
    
    setIsTranslating(true);
    let currentText = inputText;

    try {
      for (let i = 0; i < 20; i++) {
        const randomLang = "fr"
        console.log(`en > ${randomLang} > en`)

        try {
          // Translate from English to French
          const translation = await translator.translateText(
            currentText,
            'en',
            randomLang
          );

          const translationBack = await translator.translateText(
            translation,
            randomLang,
            'en'
          );

          setOutputText(translationBack)
        } catch {
          console.log('Translation error =(')
        }
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
    <div className="min-h-screen">
      <header className="text-center py-8">
        <h1 className="text-4xl font-bold mb-2">🌎 Whirld 🌏</h1>
        <p className="text-xl text-gray-600">Translate anything too many times!</p>
      </header>

      <main className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <InputPanel
            text={inputText}
            onChange={setInputText}
            onScramble={handleScramble}
            isTranslating={isTranslating}
          />
          
          {outputText && (
            <OutputPanel
              originalText={inputText}
              translatedText={outputText}
              onCopy={handleCopy}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;