import React, { useEffect, useState } from 'react'
import BiPanel from './components/BiPanel/BiPanel'
import './main.css'

// TODO Panel heights should adjust to content size

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
  // Properties shared with BiPanel
  const [inputText, setInputText] = useState('') // Set input panel content
  const [outputText, setOutputText] = useState('') // Set output panel content
  const [logText, setLogText] = useState('') // Set log panel content
  const [isTranslating, setIsTranslating] = useState(false) // Currently translatng?
  const [funBegun, setFunBegun] = useState(false) // True once first translation begins
  const [copied, setCopied] = useState(false) // Trigger output copied animation
  const [wasError, setWasError] = useState(false) // Error message

  // Others
  const [useInput, setUseInput] = useState(true) // Use input panel for input?

  const inputBtn = document.querySelector('.inputButton') || document
  const setProgress = (p) => {
    document.documentElement.style.setProperty("--loadProgress", p)
    inputBtn.textContent = p
  }
  
  const handleInputChange = async (d) => {
    // If the user clicks 'Scramble more', use the output as the input
    // But if they edit the input first, just use the input as input
    if (funBegun) {
      setUseInput(true)
      inputBtn.textContent = 'Scramble'
    }
    setInputText(d)
  }

  const handleScramble = async () => {
    if (!inputText.trim() || isTranslating) return

    // If the user clicks 'Scramble more', use the output as the input
    // But if they edit the input first, just use the input as input
    if (!useInput) setInputText(outputText)
    
    let currentText = inputText
    setIsTranslating(true)
    setFunBegun(true)
    setUseInput(false)
    setWasError(false)

    try {
      // throw new Error()
      scream({
        lang: 'en', // TODO make user-editable
        text: currentText,
        times: TIMES,
      })
    } catch (error) {
      // TODO Is displaying this a security risk?
      console.error('Translation error:', error)

      setIsTranslating(false)
      setWasError(true)
      setOutputText('Translation error: ' + error)
      return
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
    } finally {
      setCopied(true)
      setTimeout(()=>{setCopied(false)}, 200)
    }
  }

  // On each update from server
  useEffect(() => {
    ws.onmessage = (message) => {
      let data = JSON.parse(message.data)
      console.log(new Date().toISOString(), message)
      setOutputText(data.bamboozled)
      setProgress(100*data.langs.length/TIMES+'%')

      setLogText(data.langs.join(' > '))

      // If translation complete
      if (data.done) {
        setIsTranslating(false)
        setOutputText(data.bamboozled)
      } else
        setOutputText(`[${data.langs[data.langs.length-1]} ${data.langs.length-1}/${TIMES}] ${data.bamboozled}`)
    }
  }, [])

  return (
    <main>
      <div className="biPanelContainer">
        <BiPanel
          inputText={inputText}
          outputText={outputText}
          logText={logText}
          
          onChange={handleInputChange}
          onScramble={handleScramble}
          onCopy={handleCopy}

          copied={copied}
          isTranslating={isTranslating}
          funBegun={funBegun}
          wasError={wasError}
        />
      </div>
    </main>
  )
}

export default App