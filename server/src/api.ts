// TODO In general, optimize: test performance without some of the bells and whistles
import { Hono } from "hono"
import { cors } from "hono/cors"
import type { StatusCode, UnofficialStatusCode } from "hono/utils/http-status"
import { timeout } from 'hono/timeout'
import { HTTPException } from "hono/http-exception"
import { AxiosError } from "axios"
import http from "http"
import { WebSocket, WebSocketServer } from "ws"
import { GoogleTranslate } from "./GoogleCloud/GoogleTranslate"

/* Constants and configuration */

const OkStatus        = 200 as StatusCode           // Happy day!
const OvercameStatus  = 222 as UnofficialStatusCode // Aborts encountered but overcome (TODO use 200; user doesnt care)
const DetectionStatus = 288 as UnofficialStatusCode // Source language not detected or not supported, using fallback
const BailedStatus    = 299 as UnofficialStatusCode // Too many aborts in a row, had to bail and submit unfinished work
const InvalidStatus   = 400 as StatusCode           // Client made invalid request
const TeapotStatus    = 418 as StatusCode           // I am a teapot
const RIPStatus       = 500 as StatusCode           // Cannot recover; just lay down and cry

const FALLBACK_LANG = 'en' // Fallback language if source language cannot be used
const LANGUAGES = [ // TODO Update automatically https://cloud.google.com/translate/docs/basic/discovering-supported-languages
    'af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu']
const OH_CRAP_LIMIT = 5 // Fold after 5 consecutive unsuccessful translations
const TIMEOUT_AFTER = 1000 * 120 // Time out after 2 minutes TODO add this functionality

const app = new Hono()
const server = http.createServer(app.fetch as any)
const port = parseInt(process.env.PORT || "3193")
const gt = new GoogleTranslate()

/* WebSocket */
const wss = new WebSocketServer({ noServer: true })

// Handle WebSocket connections
wss.on('connection', function connection(ws : WebSocket) {
    console.log(`\x1b[1m  \n\n\n\x1b[93m${new Date().toISOString()}\x1b[0;1m New WebSocket connection \x1b[0m`)

    // Handle incoming messages
    ws.on('message', async function incoming(message : { lang : string, text : string, times : number }) {
        try {
            const parsedMessage = JSON.parse(message.toString())
            const { lang, text, times } = parsedMessage
            console.log(lang, text, times)

            ws.send("{ 'bamboozled': 'Yoohoo' }")
        } finally {}
    })
})

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

/* REST */

// Enable CORS, allow only client port
app.use("/*", cors(
    {
        origin: 'http://localhost:3000'
    }
))

// Welcome screen
// app.get("/", async (c) => {
//     c.status(TeapotStatus)
//     return c.html(`
// <!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>You spin me right round</title>
//     <style>
//         @keyframes spinny {
//             from { transform: rotate(0) scale(1); }
//             to { transform: rotate(180deg) scale(10); }
//         }
//     </style>
// </head>
// <body style="background:magenta;">
//     <h1 style="color:aqua; animation: 3s infinite alternate spinny;"><marquee>Welcome to the WHIRLD REST API...</marquee></h1>
//     <button style="font-family: 'Comic Sans', cursive; font-size: 10em" onclick="window.location='https://github.com/WriterArtistCoder/whirld/'">Click the button</button>
// </body>
// </html>
//         `)
// })

// Scramble a text

// TODO Enable timeout, make sure it doesn't keep running after returning HTTP 408
// app.use("/api/scramble", timeout(TIMEOUT_AFTER, new HTTPException(408)))

// TODO handle simultaneous requests (assign ID?)

// TODO Make API more orthodox in its error handling

// app.post("/api/scramble", async (c) => {
//     console.log(`\x1b[1m  \n\n\n\x1b[93m${new Date().toISOString()}\x1b[0;1m POST /api/scramble \x1b[0m`)
//     c.status(OkStatus) // Assume success
    
//     try {
//  /* Validation */
//         // TODO Sanitize body
//         const { lang, text, times } = await c.req.json()

//         enum LangStatus {
//             GIVEN, // Valid language was given by client
//             UNDET, // Language invalid, not yet detected
//             DETEC, // Language detected
//             NSUPP  // Langauge detected but unsupported; use fallback lang
//         }
//         let langStat = LangStatus.GIVEN
//         let langLog  = lang // List of languages used
//         let prevLang = lang // Current language of translated text
//         let outLang  = lang // Language to return translation in
//         let nspLang  = ''   // If NSUPP, store unsupported language here

//         // If lang invalid, use placeholders, we'll try to detect it later
//         if (!(typeof lang === 'string') || !LANGUAGES.includes(lang))
//             langStat = LangStatus.UNDET, langLog = '??', prevLang = undefined, outLang = FALLBACK_LANG

//         // HTTP 400 if text invalid
//         if (!(typeof text === 'string')) {
//             c.status(InvalidStatus)
//             return c.json({
//                 forshame: '"text" property should be a string'
//             })
//         }

//         // HTTP 400 if times invalid
//         if (!Number.isInteger(times) || times<2) {
//             c.status(InvalidStatus)
//             return c.json({
//                 forshame: '"times" property should be a number, 2 or more'
//             })
//         } else if (times>500) {
//             c.status(InvalidStatus)
//             return c.json({
//                 forshame: '"times" property should be a number, 500 or less'
//             })
//         }

//  /* Translation */
//         let totalAborts = 0, abortsInARow = 0
//         let translation = text

//         TRANSLATE: for (var i = 0; i < times+1; i++) {
//             if (i>0) {
//                 // Pick random lang, or if is last translation, translate into output lang
//                 let nextLang = i==times ? outLang : LANGUAGES[Math.floor(Math.random() * (LANGUAGES.length))]
//                 while (((i<times) && (nextLang == prevLang)) || // Don't pick same language, this is not accepted   (... > af > AF > ...)
//                       ((i==times-1) && nextLang == outLang))  // Don't pick output lang for penultimate translation (... > fr > EN > en)
//                     console.log('Uh oh', nextLang = LANGUAGES[Math.floor(Math.random() * (LANGUAGES.length))])
                
//                 langLog += ' > ' + nextLang

//                 try {
//                     // Perform a translation
//                     translation = await gt.translateText(translation, nextLang, prevLang)

//                     // If lang not yet detected
//                     if (langStat == LangStatus.UNDET) {
//                         // TODO handle Google Translate not detecting a language at all
//                         // Extract detected language
//                         langStat = LangStatus.DETEC
//                         outLang = translation.substring(0, translation.indexOf(' '))
//                         translation = translation.substring(translation.indexOf(' ')+1)
//                         langLog = langLog.replace('??', outLang)

//                         console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m Detected language as ${outLang}`)

//                         if (!LANGUAGES.includes(outLang)) { // If lang unsupported, use fallback
//                             console.log(`${' '.repeat(DATE_COLS)}But language is sadly unsupported`)
//                             langStat = LangStatus.NSUPP, nspLang = outLang, outLang = FALLBACK_LANG
//                         }
//                         console.log('\n')
//                     }

//                 } catch (e) {
//                     totalAborts++
//                     c.status(OvercameStatus) // Reflect in HTTP status that there was an abort

//                     // Log that there was an error
//                     console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m \x1b[30;101m Unexpected error \x1b[0;91m`)
//                     if (e instanceof AxiosError) {
//                         // If it's an AxiosError, figure out why Google is mad
//                         console.error(e.message)
//                         console.error(e.response?.data?.error)
//                     } else if (e instanceof Error) {
//                         // Otherwise, we have no idea. Just log the whole thing
//                         console.error(e.message)
//                         console.error(e)
//                     }
//                     console.log('\x1b[0m\n')

//                     if (++abortsInARow < OH_CRAP_LIMIT) {
//                         // Try again, selecting a new random language
//                         nextLang = prevLang||''; i--; continue
//                     } else {
//                         // Give up if there were too many aborts in a row
//                         try {
//                             console.log(`\x1b[1;91;103m${new Date().toISOString()}\x1b[0m \x1b[1;101m Too many errors in a row, cutting our losses \x1b[0m \n`)
                            
//                             // Tell the client how output language was decided
//                             let langFoundBy = ''
//                             switch (langStat) {
//                                 case LangStatus.GIVEN:
//                                     langFoundBy = 'Source language provided by client (yay!)'
//                                     break
                                    
//                                 case LangStatus.UNDET:
//                                     langFoundBy = `Source language not recognized, using ${outLang}`
//                                     c.status(DetectionStatus)
//                                     break
                                    
//                                 case LangStatus.DETEC:
//                                     langFoundBy = `Source language detected as ${outLang}`
//                                     break
                                    
//                                 case LangStatus.NSUPP:
//                                     langFoundBy = `Source language detected as ${nspLang}, but was unsupported; using ${outLang}`
//                                     c.status(DetectionStatus)
//                                     break
                                    
//                             }
                            
//                             // Return what we have so far, which is probably in the wrong language
//                             c.status(BailedStatus)
//                             return c.json({
//                                 bamboozled: translation,
//                                 original: text,
//                                 langs: langLog.split(' > '),
//                                 langFoundBy,
//                                 sorry: `${i} of requested ${times} translations were completed`
//                             })
//                         } catch {
//                             // If even that didn't work, lose all hope
//                             c.status(RIPStatus)
//                             return c.json({
//                                 sorry: "Sorry"
//                             })
//                         }
//                     }
//                 }
//                 prevLang = nextLang
//             }

//             abortsInARow = 0

//  /* Logging */
//             let DATE = `\x1b[93m${new Date().toISOString()}` // TODO add logging of elapsed time

//             let LANGLOG = ''

//             switch (WHAT_TO_LOG.languages) {
//                 case Pref.SOME:
//                     if (langLog.length > TERMINAL_COLS-DATE_COLS) {
//                         // Original language (highlight in green)
//                         const ll1 = langLog.substring(0, langLog.indexOf(' > ')) + ' > ... >'

//                         // Most recent translation (e.g. en > fr), highlighted in white
//                         const ll2 = langLog.substring(langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1)+2)

//                         LANGLOG = `\x1b[92m${ll1}\x1b[0m${ll2}`
//                         break
//                     }

//                 case Pref.ALL:
//                     // Languages used so far, up to most recent translation (highlight in green)
//                     const ll1 = i<2 ? '' : langLog.substring(0, langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1)+2)
                    
//                     // Most recent translation (e.g. en > fr), highlighted in white
//                     const ll2 = i<2 ? langLog : langLog.substring(langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1)+2)
                    
//                     LANGLOG = `\x1b[92m${ll1}\x1b[0m${ll2}`
//                     break
//             }

//             let PROGRESS = ''
//             switch (WHAT_TO_LOG.progress) {
//                 case Pref.SOME:
//                     PROGRESS = `\x1b[35m \n${i}/${times}`
//                     break
//                 case Pref.ALL:
//                     PROGRESS += i==times ? '\x1b[38;5;118m' : '\x1b[31m'
//                     PROGRESS += ` \n${i}/${times} (${(100*i/times).toFixed(1)}%)`
//                     if (totalAborts>0) PROGRESS += ` +${totalAborts} aborted attempt`
//                     if (totalAborts>1) PROGRESS += 's'
//                     break
//             }

//             PROGRESS += '\x1b[0m'

//             let TRANSLATION = '\n'
//             switch (WHAT_TO_LOG.translation) {
//                 case Pref.SOME:
//                     // Reduce to one line (doesn't work for larger width charcaters, such as CJK block)
//                     TRANSLATION = (translation.replaceAll('\n', ' ')).substring(0, TERMINAL_COLS-1) + '…'

//                     // Formatting
//                     TRANSLATION = `\n \x1b[34m${TRANSLATION}\n`
//                     break
                
//                 case Pref.ALL:
//                     TRANSLATION = `\n \x1b[34m${translation}\n`
//                     break
//             }

//             // Date (yellow)
//             //        Languages (green and white)
//             //                              Progress (red)
//             //                                          Translation (blue)
//             console.log(`${DATE} ${LANGLOG} ${PROGRESS} ${TRANSLATION} \x1b[0m`)
//         }

//  /* All done! */
//         // Tell the client how output language was decided
//         let langFoundBy = ''
//         switch (langStat) {
//             case LangStatus.GIVEN:
//                 langFoundBy = 'Source language provided by client (yay!)'
//                 break
                
//             case LangStatus.UNDET:
//                 langFoundBy = `Source language not recognized, using ${outLang}`
//                 c.status(DetectionStatus)
//                 break
                
//             case LangStatus.DETEC:
//                 langFoundBy = `Source language detected as ${outLang}`
//                 break
                
//             case LangStatus.NSUPP:
//                 langFoundBy = `Source language detected as ${nspLang}, but was unsupported; using ${outLang}`
//                 c.status(DetectionStatus)
//                 break
//         }
//         return c.json({
//             bamboozled: translation,
//             original: text,
//             langs: langLog.split(' > '),
//             langFoundBy
//         })
//     } catch (error : any) {
//         // If JSON parsing error, blame the customer
//         if (error instanceof SyntaxError && error.message.startsWith('JSON Parse')) {
//             console.error(error)
//             c.status(InvalidStatus)
//             return c.json({
//                 "forshame": "Invalid JSON"
//             })
//         }
//         // Otherwise, PANIIIICCC
//         else throw error
//     }
// })

console.log(`\x1b[93m${new Date().toISOString()}\x1b[95m WHIRLD server is running on port ${port} \x1b[0m`)

server.listen(port)