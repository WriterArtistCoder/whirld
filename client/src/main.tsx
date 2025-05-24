import React, { useCallback, useEffect, useState } from 'react'
import BiPanel from './components/BiPanel/BiPanel'
import './main.css'

// Open WebSocket
const ws = new WebSocket(`ws://rocketguitar.xyz:3193/api/scramble`)
const scream = (data : Object) => ws.send(JSON.stringify(data))

const TIMES = 10 // TODO make user-customizable

const savedScrambles: Object[] = [
  // TODO Implement this
]

ws.onopen = () => {
  console.log("WebSocket open to "+ws.url)
}

const App: React.FC = () => {
  // Properties shared with BiPanel
  const [inputText, setInputText] = useState('') // Set input panel content
  const [outputText, setOutputText] = useState('') // Set output panel content
  const [origText, setOrigText] = useState('') // Set original text
  const [logText, setLogText] = useState('') // Set log panel content
  const [isTranslating, setIsTranslating] = useState(false) // Currently translatng?
  const [funBegun, setFunBegun] = useState(false) // True once first translation begins
  const [copyRaw, setCopyRaw] = useState(false) // True once copied, triggering the switch to "Copy raw"
  const [copyAnim, setCopyAnim] = useState(false) // Trigger output copied animation
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
    console.log(savedScrambles)
    if (!inputText.trim() || isTranslating) return

    // If the user clicks 'Scramble more', use the output as the input
    // But if they edit the input first, just use the input as input
    if (!useInput) setInputText(outputText)
    
    let currentText = inputText
    setOrigText(currentText)

    setIsTranslating(true)
    setFunBegun(true)
    setUseInput(false)
    setWasError(false)
    setCopyRaw(false)

    // try {
    scream({
      lang: 'en', // TODO make user-editable
      text: currentText,
      times: TIMES,
    })
    // } catch (error) {
    //   // TODO Is displaying this a security risk?
    //   console.error('Translation error:', error)

    //   setIsTranslating(false)
    //   setWasError(true)
    //   setOutputText('Translation error: ' + error)
    //   return
    // }
  }

  const handleCopy = useCallback(async () => {
    let copyText = copyRaw ? outputText : `🌪️ 🌍 WHIRLD 🌏 🌪️ 
${outputText}
Guess the original:
||${origText}||
Make your own at https://brokenli.nk`
    setCopyRaw(true)

    try {
      await navigator.clipboard.writeText(copyText)
    } catch (err) {
      console.error('Failed to copy text:', err)
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = copyText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    } finally {
      setCopyAnim(true)
      setTimeout(()=>{setCopyAnim(false)}, 200)
    }
  }, [copyRaw, outputText, origText])

  // On each update from server
  useEffect(() => {
    ws.onmessage = (message) => {
      let data = JSON.parse(message.data)
      let date = new Date()
      console.log(date, message)

      // If done due to error
      if (data.error) {
        console.log('Translation error:', data.error)
        setWasError(true)
        setOutputText((data.bamboozled || outputText) + '\nTranslation error: ' + data.error)
      } else {
        // If done and successful
        if (data.done) {
          setIsTranslating(false)
          savedScrambles.push(data)
          setOutputText(data.bamboozled)
        // If still WIP
        } else
          setOutputText(`[${data.langs[data.langs.length-1]} ${data.langs.length-1}/${TIMES}] ${data.bamboozled}`)
        
        setProgress(Math.floor(100*data.langs.length/TIMES)+'%')
      }
    }
  }, [outputText])

  return (
    <main>
      <header>
        <h1>WHIRLD</h1>
        <div className="headerBlurb">Translate anything too many times!</div>
      </header>
      <div className="biPanelContainer">
        <BiPanel
          inputText={inputText}
          outputText={outputText}
          logText={logText}
          
          onChange={handleInputChange}
          onScramble={handleScramble}
          onCopy={handleCopy}

          copied={copyAnim}
          copyRaw={copyRaw}
          isTranslating={isTranslating}
          funBegun={funBegun}
          wasError={wasError}
        />
      </div>
    </main>
  )
}

export default App