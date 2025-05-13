import axios from 'axios';
import { TokenManager } from './TokenManager';

interface TranslateRequest {
  q: string;
  target: string;
  source?: string;
  format?: 'text' | 'html';
}

interface TranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
}

export class GoogleTranslate {
  private readonly tm: TokenManager;
  private static readonly API_URL = 'https://translation.googleapis.com/language/translate/v2';
  
  constructor() {
    this.tm = new TokenManager();
  }

  private generateAuthorizationHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  public async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<string> {
    try {
      const token = await this.tm.getToken();
      if (!token) {
        throw new Error('Failed to obtain authentication token');
      }

      const headers = this.generateAuthorizationHeaders(token);
      
      const requestBody: TranslateRequest = {
        q: text,
        target: targetLanguage,
        format: 'text'
      };

      if (sourceLanguage) {
        requestBody.source = sourceLanguage;
      }

      const response = await axios.post<TranslateResponse>(
        GoogleTranslate.API_URL,
        requestBody,
        { headers }
      );

      if (!response.data.data.translations?.[0]) {
        throw new Error('No translation found in response');
      }

      // If source language detected by Google Translate, tell api.ts what that was
      if (response.data.data.translations[0].detectedSourceLanguage)
        return response.data.data.translations[0].detectedSourceLanguage + ' ' + response.data.data.translations[0].translatedText

      return response.data.data.translations[0].translatedText;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired, invalidate and retry once
        this.tm.invalidateToken();
        return this.translateText(text, targetLanguage, sourceLanguage);
      }
      throw error;
    }
  }
}