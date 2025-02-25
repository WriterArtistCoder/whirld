import React, { useEffect, useState } from 'react'
import BiPanel from './components/BiPanel/BiPanel';
import './main.css'

// Open WebSocket
const ws = new WebSocket(
  `ws://localhost:3193/api/scramble`
)

ws.onopen = () => {
  console.log("WebSocket open to "+ws.url)
}

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
        ws.send(
          JSON.stringify({
            lang: 'en', // TODO make user-editable
            text: currentText,
            times: 5,
          })
        )
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

  useEffect(() => {
    ws.onmessage = (message) => {
      console.log(message.data)
    }
  }, [])

  return (
    <main>
      <div className="biPanelContainer">
        <BiPanel
          text={inputText}
          onChange={setInputText}
          onScramble={handleScramble}
          isTranslating={isTranslating}

          translatedText={outputText}
          onCopy={handleCopy}
        />
      </div>
    </main>
  );
};

export default App;