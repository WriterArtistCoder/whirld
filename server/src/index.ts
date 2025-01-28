import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { GoogleTranslate } from "./GoogleCloud/GoogleTranslate"

const app = new Hono()
const port = parseInt(process.env.PORT || "3193")
const groot = new GoogleTranslate()

const LANGUAGES = ['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'];

// Enable CORS
app.use("/*", cors())

// Scrmable a text
app.post("/api/scramble", async (c) => {
    // TODO Sanitize body and handle 400 formatting errors
    const { lang, text, times } = await c.req.json()
    let langLog = lang
    let translation = text

    if (!Number.isInteger(times) || times<2) throw new Error('"times" property should be 2 or more')

    let prevLang = lang
    for (var i = 0; i < times+1; i++) {
        if (i>0) {
            let nextLang = i==times ? lang : LANGUAGES[Math.floor(Math.random() * (LANGUAGES.length))]
            langLog += ' > ' + nextLang
            
            // console.log(translation, nextLang, prevLang)
            translation = await groot.translateText(translation, nextLang, prevLang)
            prevLang = nextLang
        }

        console.log(`${new Date().toISOString()} ${langLog}\n${translation}\n`)
    }

    c.status(200) // TODO Make this reflect actual status

    return c.json({
        bamboozled: translation,
        original: text
    })
})

console.log(`WHIRLD server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})