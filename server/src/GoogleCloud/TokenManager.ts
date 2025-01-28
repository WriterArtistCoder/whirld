import { generateJWT, requestAccessToken } from './TokenUtil'

interface Token {
  value: string
  expiresAt: number
}

class TokenGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenGenerationError'
  }
}

export class TokenManager {
  private token: Token | null = null
  private tokenExpire: NodeJS.Timeout | null = null
  private tokenPromise: Promise<string | null> | null = null

  public async getToken(): Promise<string | null> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.value
    }

    if (this.tokenPromise) {
      return await this.tokenPromise
    }

    this.tokenPromise = this.generateToken()
    const token = await this.tokenPromise
    this.tokenPromise = null

    if (!token) {
      throw new TokenGenerationError('Failed to generate new token')
    }

    return token
  }

  private async generateToken(retries: number = 3): Promise<string | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const jwtToken = await generateJWT()
        const newToken = await requestAccessToken(jwtToken)

        if (!newToken) {
          throw new Error('Received null token')
        }

        const expiresAt = Date.now() + 30 * 60 * 1000 // 30 minutes from now
        this.token = {
          value: newToken,
          expiresAt,
        }

        this.setTokenExpiry(30 * 60 * 1000) // 30 minutes
        return newToken
      } catch (error) {
        if (attempt === retries) {
          this.token = null
          throw new TokenGenerationError(
            `Failed to generate token after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        )
      }
    }
    return null
  }

  private setTokenExpiry(expiresIn: number): void {
    if (this.tokenExpire) {
      clearTimeout(this.tokenExpire)
    }

    // Refresh 1 minute before expiration
    const refreshBuffer = 60 * 1000
    const refreshTime = Math.max(0, expiresIn - refreshBuffer)

    this.tokenExpire = setTimeout(async () => {
      try {
        await this.generateToken()
      } catch (error) {
        this.invalidateToken()
        // You might want to add error logging here
        console.error('Failed to refresh token:', error)
      }
    }, refreshTime)
  }

  public invalidateToken(): void {
    if (this.tokenExpire) {
      clearTimeout(this.tokenExpire)
      this.tokenExpire = null
    }
    this.token = null
    this.tokenPromise = null
  }

  public dispose(): void {
    this.invalidateToken()
  }
}