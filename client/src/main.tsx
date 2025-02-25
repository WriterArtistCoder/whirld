import React, { useEffect, useState } from 'react'
import BiPanel from './components/BiPanel/BiPanel'
import './main.css'

// Open WebSocket
const ws = new WebSocket(
  `ws://localhost:3193/api/scramble`
)

const scream = (data : Object) => ws.send(JSON.stringify(data))
const TIMES = 10 // TODO make user-customizable

ws.onopen = () => {
  console.log("WebSocket open to "+ws.url)
}

const App: React.FC = () => {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [bothPanels, setBothPanels] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const inputBtn = document.querySelector('.inputButton') || document

  const setProgress = (p) => {
    document.documentElement.style.setProperty("--loadProgress", p)
    inputBtn.textContent = p
  }

  const handleScramble = async () => {
    if (!inputText.trim() || isTranslating) return
    setIsTranslating(true)

    let currentText = inputText
    setBothPanels(true)

    try {
      try {
        scream({
          lang: 'en', // TODO make user-editable
          text: currentText,
          times: TIMES,
        })
      } catch {
        console.log('Translation error =(')
      }
    } catch (error) {
      console.error('Translation error:', error)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
    } catch (err) {
      console.error('Failed to copy text:', err)
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = outputText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }

  useEffect(() => {
    ws.onmessage = (message) => {
      let data = JSON.parse(message.data)
      console.log(new Date().toISOString(), message)
      setOutputText(data.bamboozled)
      setProgress(100*data.langs.length/TIMES+'%')

      if (data.done) setIsTranslating(false)
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
          bothPanels={bothPanels}

          translatedText={outputText}
          onCopy={handleCopy}
        />
      </div>
    </main>
  )
}

export default App