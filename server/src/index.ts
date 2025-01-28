import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { GoogleTranslate } from "./GoogleCloud/GoogleTranslate"

const app = new Hono()
const port = parseInt(process.env.PORT || "3193")
const groot = new GoogleTranslate()

const LANGUAGES = ['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'];
const WHAT_TO_LOG = {
    languages: true,
    progress: true
}
const OH_CRAP_LIMIT = 5

// Enable CORS
app.use("/*", cors())

// Scrmable a text
app.post("/api/scramble", async (c) => {
    c.status(200)
    console.log(`\x1b[1m  \n\n\n/api/scramble \x1b[0m`)
    
    // TODO add maximum request time, abort with 504 if exceeded

    // TODO handle simeltaneous requests (assign ID?)

    // TODO Sanitize body and handle 400 formatting errors
    const { lang, text, times } = await c.req.json()
    let totalProblems = 0, problemsInARow = 0
    let langLog = lang
    let translation = text

    if (!Number.isInteger(times) || times<2) {
        c.status(400)
        return c.json({
            forshame: '"times" property should be 2 or more'
        })
    } else if (times>500) {
        c.status(400)
        return c.json({
            forshame: '"times" property should be less than 501'
        })
    }

    let prevLang = lang
    for (var i = 0; i < times+1; i++) {
        if (i>0) {
            let nextLang = i==times ? lang : LANGUAGES[Math.floor(Math.random() * (LANGUAGES.length))]
            langLog += ' > ' + nextLang
            
            try {
                translation = await groot.translateText(translation, nextLang, prevLang)
            } catch (e) {
                totalProblems++
                c.status(222) // Ad hoc HTTP code meaning 'error was overcome'

                // Log that there was an error
                // TODO log specifics
                console.log(`\x1b[30;103m${new Date().toISOString()}\x1b[0m \x1b[30;101m Unexpected error \x1b[0m \n`)

                if (++problemsInARow < OH_CRAP_LIMIT) {
                    // Reset and try again
                    nextLang = prevLang; i--; continue
                } else {
                    // Give up if there were too many problems in a row

                    try {
                        c.status(299) // Ad hoc HTTP code meaning 'error was partially overcome'
                        return c.json({
                            bamboozled: translation,
                            original: text,
                            langs: langLog.split(' > '),
                            sorry: `${i} of requested ${times} translations were completed`
                        })
                    } catch {
                        c.status(500)
                        return c.json({
                            sorry: "Sorry"
                        })
                    }
                }
            }
            prevLang = nextLang
        }

        problemsInARow = 0

        // Logging

        let DATE = `\x1b[93m${new Date().toISOString()}`

        // TODO add logging of elapsed time

        let LANGLOG = ''

        if (WHAT_TO_LOG.languages) {
            // Languages used so far, up to most recent translation (highlight in green)
            const ll1 = langLog.substring(0, langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1))
            
            // Most recent translation (e.g. en > fr), highlighted in white
            const ll2 = langLog.substring(langLog.lastIndexOf(' > ', langLog.lastIndexOf(' > ')-1))
            
            LANGLOG = `\x1b[92m${ll1}\x1b[0m${ll2}`
        }

        let PROGRESS = ''
        if (WHAT_TO_LOG.progress) {
            PROGRESS = `\x1b[91m \n${i}/${times} (${Math.floor(1000*i/times)/10}%)`;
            if (totalProblems>0) PROGRESS += ` +${totalProblems} aborted attempt`
            if (totalProblems>1) PROGRESS += 's'
        }

        let TRANSLATION = `\n \x1b[34m${translation}\n`

        // Date (yellow)
        //        Languages (green and white)
        //                              Progress (red)
        //                                          Translation (blue)
        console.log(`${DATE} ${LANGLOG} ${PROGRESS} ${TRANSLATION} \x1b[0m`)
    }

    return c.json({
        bamboozled: translation,
        original: text,
        langs: langLog.split(' > ')
    })
})

console.log(`WHIRLD server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})