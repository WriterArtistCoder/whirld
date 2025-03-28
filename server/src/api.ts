// TODO Optimize, test performance without some of the bells and whistles
// TODO Make API more orthodox in its error handling, are there websocket status codes?

import { Hono } from "hono"
import { cors } from "hono/cors"
import { AxiosError } from "axios"
import http from "http"
import { WebSocket, WebSocketServer } from "ws"
import { v4 as uuidv4 } from 'uuid'
import { GoogleTranslate } from "./GoogleCloud/GoogleTranslate"

/* Constants and configuration */

const FALLBACK_LANG = 'en' // Fallback language if source language cannot be used
const LANGUAGES = [ // TODO Update automatically https://cloud.google.com/translate/docs/basic/discovering-supported-languages
    'af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu']
const OH_CRAP_LIMIT = 5 // Fold after 5 consecutive unsuccessful translations
const TIMEOUT_AFTER = 2 * 60 * 1000 // Time out after 2 minutes

const app = new Hono()
const server = http.createServer(app.fetch as any)
const port = parseInt(process.env.PORT || "3193")
const gt = new GoogleTranslate()

/* Logging */

const TERMINAL_COLS = 80 // Max columns in terminal
const DATE_COLS = 25 // Columns taken up by yellow timestamp
enum Pref {
    ALL,
    SOME,
    REDACT
}
const WHAT_TO_LOG = { // TODO set this through command line flags
    languages: Pref.SOME,
    progress: Pref.ALL,
    translation: Pref.SOME
}
const ANSI_LOGGING = true // Toggle ANSI formatting

// Log to file as well as stdout
const fs = require('fs')
const util = require('util')
const logFile = fs.createWriteStream('annals.txt', { flags: 'a' })
const logStdout = process.stdout

console.log = function () {
    // Write to file, stripping ANSI formatting
    logFile.write(util.format.apply(null, arguments).replace(/\x1b\[[0-9;]+m/g, '') + '\n')

    // If unwanted, strip from stdout as well
    if (ANSI_LOGGING) logStdout.write(util.format.apply(null, arguments) + '\n')
    else logStdout.write(util.format.apply(null, arguments).replace(/\x1b\[[0-9;]+m/g, '') + '\n')
}
console.error = console.log

/* WebSocket */

const wss = new WebSocketServer({ noServer: true })

// Handle WebSocket connections
wss.on('connection', function connection(ws : WebSocket) {
    const id = uuidv4()
    const scream = (data : Object) => ws.send(JSON.stringify(data))

    console.log(`\n\x1b[93m${new Date().toISOString()}\x1b[0m New WebSocket connection ${id}`)

    ws.on('close', async function closed(message : string) {
        console.log(`\n\x1b[93m${new Date().toISOString()}\x1b[0m WebSocket connection ended ${id}`)
    })

    // Handle incoming messages: scramble text
    ws.on('message', async function incoming<T>(message : string): Promise<void> {
        scramble(message, Date.now() + TIMEOUT_AFTER)
    })
    
    async function scramble(message : string, stopBy : number) {
        console.log(`\x1b[1m  \n\n\n\x1b[93m${new Date().toISOString()}\x1b[0;1m POST /api/scramble ${id} \x1b[0m`)
    
        let lang, text, times

/* Validation */
        try {
            // TODO Sanitize body
            const parsedMessage = JSON.parse(message.toString())

            lang = parsedMessage.lang
            text = parsedMessage.text
            times = parsedMessage.times
        } catch (error : any) {
            // If JSON parsing error, blame the customer
            if (error instanceof SyntaxError && error.message.startsWith('JSON Parse')) {
                console.error(error)
                scream({
                    error: "Invalid JSON",
                    done: true
                })
                return
            }
            // Otherwise, PANIIIICCC
            else throw error
        }
       
        enum LangStatus {
            GIVEN, // Valid language was given by client
            UNDET, // Language invalid, not yet detected
            DETEC, // Language detected
            NSUPP  // Langauge detected but unsupported; use fallback lang
        }
        let langStat = LangStatus.GIVEN
        let langLog  = lang // List of languages used
        let prevLang = lang // Current language of translated text
        let outLang  = lang // Language to return translation in
        let nspLang  = ''   // If NSUPP, store unsupported language here
    
        // If lang invalid, use placeholders, we'll try to detect it later
        if (!(typeof lang === 'string') || !LANGUAGES.includes(lang))
            langStat = LangStatus.UNDET, langLog = '??', prevLang = undefined, outLang = FALLBACK_LANG

        // HTTP 400 if text invalid
        if (!(typeof text === 'string')) {
            scream({
                error: '"text" property should be a string',
                done: true
            })
            return
        }

        // HTTP 400 if times invalid
        if (!Number.isInteger(times) || times<2) {
            scream({
                error: '"times" property should be a number, 2 or more',
                done: true
            })
            return
        } else if (times>500) {
            scream({
                error: '"times" property should be a number, 500 or less',
                done: true
            })
            return
        }

/* Translation */
        let totalAborts = 0, abortsInARow = 0
        let translation = text

        for (var i = 0; i < times+1; i++) {
            if (Date.now() > stopBy) {
                // TODO Return what we have for partial credit, like is done after too many consecutive errors?
                console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m \x1b[30;101m Timed out after ${TIMEOUT_AFTER}ms \x1b[0;91m`)
                scream({
                    error: `Request timed out after ${TIMEOUT_AFTER}ms`,
                    done: true
                })
                return
            }

            if (i>0) {
                let nextLang

                if (i==times) // Pick output lang for final translation
                    nextLang = outLang
                else {
                    do  // Pick random lang
                        nextLang = LANGUAGES[Math.floor(Math.random() * (LANGUAGES.length))]
                    while (((i<times) && (nextLang == prevLang)) || // No "circular translations" e.g. af > af
                           (i==(times-1) && nextLang == outLang)) // Don't pick output lang for 2nd-to-last translation, this will force a circular
                }

                try {
                    // Perform a translation
                    translation = await gt.translateText(translation, nextLang, prevLang)

                    // If lang not yet detected, extract detected language
                    if (langStat == LangStatus.UNDET && i==0) {
                        langStat = LangStatus.DETEC
                        outLang = translation.substring(0, translation.indexOf(' '))
                        translation = translation.substring(translation.indexOf(' ')+1)
                        langLog = langLog.replace('??', outLang)

                        console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m Detected language as ${outLang}`)

                        if (!LANGUAGES.includes(outLang)) { // If lang unsupported, use fallback
                            console.log(`${' '.repeat(DATE_COLS)}But language is sadly unsupported`)
                            langStat = LangStatus.NSUPP, nspLang = outLang, outLang = FALLBACK_LANG
                        }
                        console.log('\n')
                    }

                    langLog += ' > ' + nextLang

                } catch (e) {
                    totalAborts++
                        
                    // Log that there was an error
                    console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m \x1b[30;101m Unexpected error \x1b[0;91m`)
                    if (e instanceof AxiosError) {
                        // If it's an AxiosError, figure out why Google is mad
                        console.error(e.message)
                        console.error(e.response?.data?.error)
                    } else if (e instanceof Error) {
                        // Otherwise, we have no idea. Just log the whole thing
                        console.error(e.message)
                        console.error(e)
                    }
                    console.log('\x1b[0m\n')

                    if (++abortsInARow < OH_CRAP_LIMIT) {
                        // Try again, selecting a new random language
                        nextLang = prevLang||''; i--; continue
                    } else {
                        // Give up if there were too many aborts in a row
                        try {
                            console.log(`\x1b[1;91;103m${new Date().toISOString()}\x1b[0m \x1b[1;101m Too many errors in a row, cutting our losses \x1b[0m \n`)
                            
                            // Tell the client how output language was decided
                            let langFoundBy = ''
                            switch (+langStat) {
                                case LangStatus.GIVEN:
                                    langFoundBy = 'Source language provided by client (yay!)'
                                    break
                                    
                                case LangStatus.UNDET:
                                    langFoundBy = `Source language not recognized, using ${outLang}`
                                    break
                                    
                                case LangStatus.DETEC:
                                    langFoundBy = `Source language detected as ${outLang}`
                                    break
                                    
                                case LangStatus.NSUPP:
                                    langFoundBy = `Source language detected as ${nspLang}, but was unsupported; using ${outLang}`
                                    break
                            }
                            
                            // Return what we have so far, which is probably in the wrong language
                            scream({
                                bamboozled: translation,
                                original: text,
                                langs: langLog.split(' > '),
                                langFoundBy,
                                error: `${i-1} of requested ${times} translations were completed`,
                                done: true
                            })
                            return
                        } catch {
                            // If even that didn't work, lose all hope
                            scream({
                                error: "Sorry",
                                done: true
                            })
                            return
                        }
                    }
                }

                scream({
                    bamboozled: translation,
                    original: text,
                    langs: langLog.split(' > '),
                    done: false
                })
                prevLang = nextLang
            }

            abortsInARow = 0

/* Logging */
            logTranslation(id, new Date(), langLog, i, times, totalAborts, translation)
        }

/* All done! */
        // Tell the client how output language was decided
        let langFoundBy = ''
        switch (+langStat) {
            case LangStatus.GIVEN:
                langFoundBy = 'Source language provided by client (yay!)'
                break
                
            case LangStatus.UNDET:
                langFoundBy = `Source language not recognized, using ${outLang}`
                break
                
            case LangStatus.DETEC:
                langFoundBy = `Source language detected as ${outLang}`
                break
                
            case LangStatus.NSUPP:
                langFoundBy = `Source language detected as ${nspLang}, but was unsupported; using ${outLang}`
                break
        }
        scream({
            bamboozled: translation,
            original: text,
            langs: langLog.split(' > '),
            langFoundBy,
            done: true
        })
        return
    }
})

const logTranslation = function(id : string, date : Date, langLog : string, i : number, times : number, totalAborts : number, translation : string) {
    let DATE = `\x1b[93m${date.toISOString()}` // TODO add logging of elapsed time

    let LANGLOG = ''

    switch (WHAT_TO_LOG.languages) {
        case Pref.SOME:
            if (langLog.length > TERMINAL_COLS-DATE_COLS) {
                // Original language (highlight in green)
                const ll1 = langLog.substring(0, langLog.indexOf(' > ')) + ' > ... >'

                // Most recent translation (e.g. en > fr), highlighted in white
                const ll2 = langLog.substring(langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1)+2)

                LANGLOG = `\x1b[92m${ll1}\x1b[0m${ll2}`
                break
            }

        case Pref.ALL:
            // Languages used so far, up to most recent translation (highlight in green)
            const ll1 = i<2 ? '' : langLog.substring(0, langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1)+2)
            
            // Most recent translation (e.g. en > fr), highlighted in white
            const ll2 = i<2 ? langLog : langLog.substring(langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1)+2)
            
            LANGLOG = `\x1b[92m${ll1}\x1b[0m${ll2}`
            break
    }

    let PROGRESS = '\n' + id
    switch (WHAT_TO_LOG.progress) {
        case Pref.SOME:
            PROGRESS += `\x1b[35m ${i}/${times}`
            break
        case Pref.ALL:
            PROGRESS += i==times ? ' \x1b[38;5;118m' : ' \x1b[31m'
            PROGRESS += `${i}/${times} (${(100*i/times).toFixed(1)}%)`
            if (totalAborts>0) PROGRESS += ` +${totalAborts} aborted attempt`
            if (totalAborts>1) PROGRESS += 's'
            break
    }

    PROGRESS += `\x1b[0m`

    let TRANSLATION = '\n'
    switch (WHAT_TO_LOG.translation) {
        case Pref.SOME:
            // Reduce to one line (doesn't work for larger width charcaters, such as CJK block)
            TRANSLATION = (translation.replaceAll('\n', ' ')).substring(0, TERMINAL_COLS-1) + '…'

            // Formatting
            TRANSLATION = `\n \x1b[34m${TRANSLATION}\n`
            break
        
        case Pref.ALL:
            TRANSLATION = `\n \x1b[34m${translation}\n`
            break
    }

    // Date (yellow)
    //        Languages (green and white)
    //                              Progress (red)
    //                                          Translation (blue)
    console.log(`${DATE} ${LANGLOG} ${PROGRESS} ${TRANSLATION} \x1b[0m`)
}

server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname
    
    if (pathname === '/api/scramble') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request)
        })
    } else {
        socket.destroy()
    }
})

// Enable CORS, allow only client port
// TODO is this still needed?
app.use("/*", cors(
    {
        origin: 'http://localhost:3000'
    }
))

console.log(`\x1b[93m${new Date().toISOString()}\x1b[95m WHIRLD server is running on port ${port} \x1b[0m`)

server.listen(port)