// TODO Optimize; test performance without some of the bells and whistles

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import type { StatusCode, UnofficialStatusCode } from "hono/utils/http-status"
import { timeout } from 'hono/timeout'
import { HTTPException } from "hono/http-exception"

import { GoogleTranslate } from "./GoogleCloud/GoogleTranslate"
import { AxiosError } from "axios"

const app = new Hono()
const port = parseInt(process.env.PORT || "3193")
const groot = new GoogleTranslate()

const DEFAULT_LANG = 'en' // Fallback language if source language cannot be used
const LANGUAGES = ['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'];
const OH_CRAP_LIMIT = 5 // Fold after 5 consecutive unsuccessful translations
const TIMEOUT_AFTER = 1000 * 120 // Time out after 2 minutes

const OkStatus = 200 as StatusCode                  // Happy day!
const OvercameStatus = 222 as UnofficialStatusCode  // Errors encountered but overcome (TODO use 200; user doesnt care)
const DetectionStatus = 288 as UnofficialStatusCode // Source language not detected or cannot be translated into, using default lang
const BailedStatus = 299 as UnofficialStatusCode    // Too many errors in a row, had to bail and submit unfinished work
const USuckStatus = 400 as StatusCode               // It's your fault
const TeapotStatus = 418 as StatusCode              // I am a teapot
const RIPStatus = 500 as StatusCode                 // Died

/* Logging */

const TERMINAL_COLS = 80 // Max columns in terminal
const DATE_COLS = 25 // Columns taken up by yellow timestamp
enum Pref {
    ALL,
    SOME,
    REDACT
}
const WHAT_TO_LOG = { // TODO set this through flags
    languages: Pref.SOME,
    progress: Pref.ALL,
    translation: Pref.SOME
}
const ANSI_LOGGING = true // Turn on/off ANSI formatting escape codes

// Log to file as well as stdout
var fs = require('fs')
var util = require('util')
var logFile = fs.createWriteStream('annals.txt', { flags: 'a' })
var logStdout = process.stdout

console.log = function () {
    // Write to file, stripping ANSI formatting
    logFile.write(util.format.apply(null, arguments).replace(/\x1b\[[0-9;]+m/g, '') + '\n')

    // If unwanted, strip from stdout as well
    if (ANSI_LOGGING) logStdout.write(util.format.apply(null, arguments) + '\n')
    else logStdout.write(util.format.apply(null, arguments).replace(/\x1b\[[0-9;]+m/g, '') + '\n')
}
console.error = console.log

// Enable CORS
app.use("/*", cors())

// Welcome screen
app.get("/api/scramble", async (c) => {
    c.status(TeapotStatus)
    return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You spin me right round</title>
    <style>
        @keyframes spinny {
            from { transform: rotate(0) scale(1); }
            to { transform: rotate(180deg) scale(10); }
        }
    </style>
</head>
<body style="background:magenta;">
    <h1 style="color:aqua; animation: 3s infinite alternate spinny;"><marquee>Welcome to the WHIRLD REST API...</marquee></h1>
    <button style="font-family: 'Comic Sans', cursive; font-size: 10em" onclick="window.location='https://github.com/WriterArtistCoder/whirld/'">Click the button</button>
</body>
</html>
        `)
})

/* Scramble a text */

// TODO Enable timeout, make sure it doesn't keep running after returning HTTP 408
// app.use("/api/scramble", timeout(TIMEOUT_AFTER, new HTTPException(408)))

app.post("/api/scramble", async (c) => {
    c.status(OkStatus)
    console.log(`\x1b[1m  \n\n\n\x1b[93m${new Date().toISOString()}\x1b[0m POST /api/scramble`)

    // TODO handle simultaneous requests (assign ID?)

    // TODO Make API more orthodox in its error handling
    
    try {
/* Validation */
        // TODO Sanitize body
        const { lang, text, times } = await c.req.json()

        enum LangStatus {
            GIVEN, // Valid language was given by client
            UNDET, // Language invalid, and not yet detected
            DETEC, // Language detected
            NSUPP  // Langauge detected but unsupported
        }
        let langStat = LangStatus.GIVEN
        let langLog  = lang // List of languages used
        let prevLang = lang // Current language of translated text
        let outLang  = lang // Language to return translation in
        let nspLang  = ''   // If NSUPP, store unsupported language here

        // If lang invalid, use placeholders
        if (!(typeof lang === 'string') || !LANGUAGES.includes(lang))
            langStat = LangStatus.UNDET, langLog = '??', prevLang = undefined, outLang = DEFAULT_LANG

        // HTTP 400 if text invalid
        if (!(typeof text === 'string')) {
            c.status(USuckStatus)
            return c.json({
                forshame: '"text" property should be a string'
            })
        }

        // HTTP 400 if times invalid
        if (!Number.isInteger(times) || times<2) {
            c.status(USuckStatus)
            return c.json({
                forshame: '"times" property should be a number, 2 or more'
            })
        } else if (times>500) {
            c.status(USuckStatus)
            return c.json({
                forshame: '"times" property should be a number, 500 or less'
            })
        }

/* Translation */
        let totalProblems = 0, problemsInARow = 0
        let translation = text

        for (var i = 0; i < times+1; i++) {
            if (i>0) {
                let nextLang = i==times ? outLang : LANGUAGES[Math.floor(Math.random() * (LANGUAGES.length))]
                langLog += ' > ' + nextLang
                
                try {
                    translation = await groot.translateText(translation, nextLang, prevLang)
                    if (langStat == LangStatus.UNDET) {
                        // TODO handle Google Translate not detecting a language at all
                        // Extract detected language
                        langStat = LangStatus.DETEC

                        outLang = translation.substring(0, translation.indexOf(' '))
                        translation = translation.substring(translation.indexOf(' ')+1)
                        langLog = langLog.replace('??', outLang)
                        console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m Detected language as ${outLang}`)

                        if (!LANGUAGES.includes(outLang)) { // If language cannot be translated into, use default
                            langStat = LangStatus.NSUPP
                            console.log(`${' '.repeat(DATE_COLS)}But language is sadly unsupported\n`)
                            nspLang = outLang
                            outLang = DEFAULT_LANG
                        } else { // But if it can be, use it
                            console.log('\n')
                        }
                    }

                } catch (e) {
                    totalProblems++
                    c.status(OvercameStatus)

                    // Log that there was an error (TODO get to the bottom of these errors)
                    console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m \x1b[30;101m Unexpected error \x1b[0;91m`)
                    if (e instanceof AxiosError) {
                        console.error(e.message)
                        console.error(e.response?.data?.error)
                    } else if (e instanceof Error) {
                        console.error(e.message)
                        console.error(e)
                    }
                    console.log('\x1b[0m\n')

                    if (++problemsInARow < OH_CRAP_LIMIT) {
                        // Reset and try again
                        nextLang = prevLang||''; i--; continue
                    } else {
                        // Give up if there were too many problems in a row

                        try {
                            console.log(`\x1b[1;91;103m${new Date().toISOString()}\x1b[0m \x1b[1;101m Too many errors in a row, cutting our losses \x1b[0m \n`)
                            
                            let langFoundBy = ''
                            switch (langStat) {
                                case LangStatus.GIVEN:
                                    langFoundBy = 'Source language provided by client (yay!)'
                                    break
                                    
                                case LangStatus.UNDET:
                                    langFoundBy = `Source language not recognized, using ${outLang}`
                                    c.status(DetectionStatus)
                                    break
                                    
                                case LangStatus.DETEC:
                                    langFoundBy = `Source language detected as ${outLang}`
                                    break
                                    
                                case LangStatus.NSUPP:
                                    langFoundBy = `Source language detected as ${nspLang}, but was unsupported; using ${outLang}`
                                    c.status(DetectionStatus)
                                    break
                                    
                            }
                            
                            c.status(BailedStatus)
                            return c.json({
                                bamboozled: translation,
                                original: text,
                                langs: langLog.split(' > '),
                                langFoundBy,
                                sorry: `${i} of requested ${times} translations were completed`
                            })
                        } catch {
                            c.status(RIPStatus)
                            return c.json({
                                sorry: "Sorry"
                            })
                        }
                    }
                }
                prevLang = nextLang
            }

            problemsInARow = 0

/* Logging */
            let DATE = `\x1b[93m${new Date().toISOString()}` // TODO add logging of elapsed time

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

            let PROGRESS = ''
            switch (WHAT_TO_LOG.progress) {
                case Pref.SOME:
                    PROGRESS = `\x1b[35m \n${i}/${times}`
                    break
                case Pref.ALL:
                    PROGRESS += i==times ? '\x1b[38;5;118m' : '\x1b[31m'
                    PROGRESS += ` \n${i}/${times} (${(100*i/times).toFixed(1)}%)`
                    if (totalProblems>0) PROGRESS += ` +${totalProblems} aborted attempt`
                    if (totalProblems>1) PROGRESS += 's'
                    break
            }

            PROGRESS += '\x1b[0m'

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

        let langFoundBy = ''
        switch (langStat) {
            case LangStatus.GIVEN:
                langFoundBy = 'Source language provided by client (yay!)'
                break
                
            case LangStatus.UNDET:
                langFoundBy = `Source language not recognized, using ${outLang}`
                c.status(DetectionStatus)
                break
                
            case LangStatus.DETEC:
                langFoundBy = `Source language detected as ${outLang}`
                break
                
            case LangStatus.NSUPP:
                langFoundBy = `Source language detected as ${nspLang}, but was unsupported; using ${outLang}`
                c.status(DetectionStatus)
                break
                
        }

        return c.json({
            bamboozled: translation,
            original: text,
            langs: langLog.split(' > '),
            langFoundBy
        })
    } catch (error : any) {
        // If JSON parsing error, blame the customer
        if (error instanceof SyntaxError && error.message.startsWith('JSON Parse')) {
            console.error(error)
            c.status(USuckStatus)
            return c.json({
                "forshame": "Invalid JSON"
            })
        }
        // Otherwise, PANIIIICCC
        else throw error
    }
})

console.log(`\x1b[93m${new Date().toISOString()}\x1b[95m WHIRLD server is running on port ${port} \x1b[0m`)

// TODO Use this (overly complicated?)
/*function dateStr(BEGINNING: number) {
    let string = ''
    string += new Date().toISOString()

    let mss = ''
    let ms = Date.now()-BEGINNING

    if (ms >= 10000) mss = (ms/1000).toFixed(2) + 's'
    else if (ms >= 100) mss = (ms/1000).toFixed(3) + 's'
    else mss = ms + 'ms'

    string += ' ' + '       '.substring(mss.length)
    string += mss

    return string
}*/

serve({
    fetch: app.fetch,
    port
})