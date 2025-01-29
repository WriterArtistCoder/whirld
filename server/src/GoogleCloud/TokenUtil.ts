import axios from 'axios'
// import { env } from 'env.mjs' TODO can i delete this
import jwt from 'jsonwebtoken'

const scope = 'https://www.googleapis.com/auth/cloud-platform'
const tokenEndpoint = 'https://oauth2.googleapis.com/token'

export function generateJWT() {
  const currentTime = Math.floor(Date.now() / 1000)
  const expirationTime = currentTime + 3600 // 1 hour
  const payload = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    scope: scope,
    aud: tokenEndpoint,
    exp: expirationTime,
    iat: currentTime,
  }

  const PKEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const token = jwt.sign(payload, PKEY || '', {
    algorithm: 'RS256',
  })

  return token
}

export async function requestAccessToken(jwtToken: string) {
  const params = new URLSearchParams()
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  params.append('assertion', jwtToken)

  try {
    const response = await axios.post(tokenEndpoint, params)
    const { access_token } = response.data
    return access_token
  } catch (error: any) {
    console.error('Error requesting access token:', error.message)
    throw error
  }
}