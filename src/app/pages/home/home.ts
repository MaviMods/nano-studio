import {ChangeDetectionStrategy, Component, computed, inject, signal, OnInit} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {PromptHistoryItem} from '../../models/prompt.model';
import {AiService} from '../../services/core/ai/ai.service';
import {LoadingMessagesService} from '../../services/loading-messages/loading-messages.service';
import {TruncateTextPipe} from '../../pipes/truncate-text/truncate-text-pipe';
import {UserPromptService} from '../../services/user-prompt/user-prompt.service';
import {AuthService} from '../../services/core/auth/auth.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, NgOptimizedImage, TruncateTextPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  // Floating update signals
  readonly showFloatingUpdate = signal<boolean>(true);
  readonly floatingUpdateMessage = signal<string>('Dont try real girl image');

  // Preset prompts (could be externalized to a service later)
  readonly presets = signal<{ id: number; title: string; description: string }[]>([
    {
      id: 1,
      title: 'Bikini',
      description: 'Create an ultra-realistic portrait based on the reference image, preserving each woman’s original face, expression, body shape, pose, posture, gesture, lighting, environment, and background exactly as they appear. Do not alter faces, skin tone, skin texture, or proportions. For every woman, replace her clothing with a matching triangle-style bikini top and bottom (no pants of any kind). Her midriff and navel must remain naturally visible. Focus on lifelike skin detail, accurate anatomy, natural shading, and overall realism. Maintain the full composition, camera angle, and lighting conditions of the reference image. No men should appear in the scene. Do not add, remove, or modify any people other than replacing the women’s clothing as specified.'
    },
    {
      id: 2,
      title: 'Bikini V2',
      description: 'Use the original image as the full reference. Keep every person’s pose, posture, gesture, expression, body proportions, skin tone, skin texture, lighting, background, realism, and camera angle exactly the same. Do not alter any faces, hair, makeup, lips, body shape, or any details of men. For every woman in the image, change only her clothing. Replace her outfit with a two-piece swimsuit made of smooth stretch swimwear fabric. The swimsuit must use a bandeau-style halter with a wrap-around top that is soft and unpadded. Do not alter the fit, posture, or natural movement of her body. Do not change anything else in the scene. Maintain identical composition and overall styling.'
    },
    {
      id: 3,
      title: 'Beach Lying',
      description: 'Create an ultra-realistic 8K HDR image of the person exactly as in the uploaded photo. Preserve her face, expression, body, and proportions precisely—replicate every feature 200% accurately. She is lying on sunlit sand at a vibrant seaside, wearing a yellow-green leaf-pattern bikini with separate top and bottom, with her belly fully visible. Capture her full figure in a close-angle shot, with sunlight reflecting naturally on sand and water. Render highly realistic textures for skin, bikini, sand, and sea. Apply cinematic lighting and shallow depth of field focused on her, maintaining the exact expression, face, and body from the uploaded photo. The scene should be warm, natural, and photo-realistic, with no alterations to her appearance.'
    },
    {
      id: 4,
      title: 'Bikini Stand',
      description: 'Keep the same face, facial expression, body proportions, background, lighting, hairstyle, and camera angle as the reference image. Do not change the face or its expression. The person is standing in a confident fashion-pose with one leg slightly forward and the upper body leaning forward noticeably, hand resting on the thigh. Change only the outfit. The outfit is a modern, stylish two-piece bikini with a deep sweetheart neckline and coordinated bottoms, paired with trendy high-heel sneakers. Maintain the same background, lighting, shadows, and realistic appearance as the original image.'
    },
    {
      id: 5,
      title: 'Bikini Dance',
      description: 'Keep the exact same face, facial features, expression, and hairstyle as in the reference image with no changes. Place her on a beach in natural daylight, wearing a full two-piece bikini. She performs a graceful classical dance pose, looking directly at the camera. Her hands are empty. Use a medium shot, not a long shot, with realistic lighting and natural details.'
    },
    {
      id: 6,
      title: 'Beach Bikini',
      description: 'Use the reference image as the base. Keep the same person, face, facial expression, hairstyle, and body exactly as in the original with no face changes. If the reference image has two people, include both of them in the same beach scene, interacting naturally while keeping their original faces and expressions. Change only the background to a bright, sunny beach with blue sky and gentle ocean waves. Pose the person naturally leaning slightly forward or sideways as if enjoying the beach breeze. Dress the person in a solid-colored bikini of any random color (not limited to blue) suitable for a beach setting. Maintain warm, natural beach lighting and realistic shadows for a vibrant, relaxed atmosphere.'
    },
    {
      id: 7,
      title: 'Beach Knees',
      description: 'Use the reference image as the base. Keep the same person, face, facial expression, hairstyle, and body exactly as in the original with no face changes. If the reference image has two people, include both of them together in the same scene, preserving their faces and expressions. Change only the background to a bright, sunny beach with soft sand and clear blue sky. Position the person kneeling naturally on the sand with legs slightly apart for balance, looking toward the camera with a happy, relaxed expression. Dress the person in a modest, solid-colored bikini of any random color (not limited to blue) suitable for a beach setting. Maintain realistic sunlight, soft shadows, and natural beach lighting that enhances a cheerful, vacation-like atmosphere.'
    },
    {
      id: 8,
      title: 'Kidnap',
      description: 'A cinematic, high-detail photograph of an indian woman ( use uploaded photo for face and body ) wearing the same dress but it is slashed and full dirty showing blwck bra strap and cleveage She is slumped on a dirty concrete floor. She is bound: her hands are tied with white rope and her dress us littile upward from legs. Legs stretched both sides maximum and show her thighs, no cloths on the thighs, She appears unconscious or sleeping, leaning sideways against a massive, crinkled black plastic trash bag. The setting is a cramped, cluttered storage room with a low ceiling.'
    },
    {
      id: 9,
      title: 'Kidnap Bikini',
      description: 'A cinematic, high-detail photograph of an indian woman ( use uploaded photo for face and body ) wearing a light triangle-bikini. She is slumped on a dirty concrete floor. She is bound: her hands are  with white rope. She appears unconscious or sleeping, leaning sideways against a massive, crinkled black plastic trash bag. The setting is a cramped, cluttered storage room with a low ceiling.'
    },
    {
      id: 10,
      title: 'Breast Feeding',
      description: 'The person from my uploaded image sitting comfortably in a soft gray armchair beside a bright window, naturally breastfeeding a baby with gentle, real interaction. She looks directly at the camera with a calm, warm smile. The scene is softly lit by natural daylight, creating a peaceful indoor atmosphere with a softly blurred background. Maintain a realistic photographic tone. Dress her in a colored, modest two-piece outfit inspired by swimwear style, featuring a v-neck top with straps and bottom, designed to look natural and appropriate for a relaxed indoor moment. Keep her face exactly the same as in the uploaded image.'
    },
    {
      id: 11,
      title: 'Train',
      description: 'Create a hyper-realistic image of the same young woman from the reference photo, keeping her face, expression, and body shape 100% identical. She has porcelain-white skin and expressive eyes, standing in the heat of a crowded Kolkata train car. She has a curvy figure and wears a net saree with a sleeveless blouse. In a natural candid motion, she lifts both hand behind her head to tie her long dark hair into a ponytail, causing the saree pleats to reveal her midriff fully. Her skin glistens with sweat from the humid environment, reflecting realistic moisture on her face, arms, and torso. Capture a confident, triumphant smile as she poses, with men seated behind her. Maintain realistic lighting, textures, and proportions, without altering her face or body.'
    },
    {
      id: 12,
      title: 'ananya',
      description: 'Use the provided image as the full structural reference. Keep the pose, facial expression, hand positions, leg position, seating angle, background, lighting, shadows, and every other person exactly the same. Preserve the entire composition 100% unchanged. Change her outfit with a white cropped T-shirt with red trim and red graphic text, along with red tie-side bikini bottoms of the same shade and style described. Keep the shirt’s slightly wet or translucent look if it exists. Do not change any colors, and do not alter her skin tone or hair unless they already naturally match. Maintain photorealistic detail and maximum fidelity to the original scene'
    }
  ]);

  readonly selectedPreset = signal<string | null>(null);

  // Auth state
  private authService = inject(AuthService);
  readonly isAuthed = computed(() => this.authService.isAuthenticated());

  // User input state
  readonly prompt = signal<string>('');
  readonly file = signal<File | null>(null);
  readonly filePreviewUrl = signal<string | null>(null);

  base64Image= signal<string | null>(null);

  // Generation state
  readonly loading = signal<boolean>(false);
  readonly resultUrl = signal<string | null>(null);

  // History backed by UserPromptService
  readonly userPromptService = inject(UserPromptService);
  readonly history = computed<PromptHistoryItem[]>(() => {
    const items = this.userPromptService.prompts();
    return items.map(it => {
      const created = it.createdAt;
      const timestamp = created && typeof (created as { toMillis: () => number }).toMillis === 'function'
        ? (created as { toMillis: () => number }).toMillis()
        : Date.now();
      return { prompt: it.prompt, timestamp };
    });
  });
  readonly activeHistoryItem = signal<PromptHistoryItem | null>(null);

  readonly canGenerate = computed(() => !!this.base64Image() && this.prompt().trim().length > 0 && !this.loading());
  readonly hasResult = computed(() => this.resultUrl() !== null);

  aiService = inject(AiService);
  loadingMessagesService = inject(LoadingMessagesService);

  ngOnInit() {
    this.checkFloatingUpdateDismissed();
  }

  // Floating update methods
  dismissFloatingUpdate() {
    this.showFloatingUpdate.set(false);
    // Save dismissal to localStorage with message hash
    try {
      const message = this.floatingUpdateMessage();
      const key = `floatingUpdate_v2:${this.hashMessage(message)}`;
      localStorage.setItem(key, '1');
    } catch (e) {
      console.warn('Could not access localStorage');
    }
  }

  private checkFloatingUpdateDismissed() {
    try {
      const message = this.floatingUpdateMessage();
      const key = `floatingUpdate_v2:${this.hashMessage(message)}`;
      const isDismissed = localStorage.getItem(key);
      this.showFloatingUpdate.set(!isDismissed);
    } catch (e) {
      console.warn('Could not access localStorage');
    }
  }

  private hashMessage(message: string): string {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < message.length; i++) {
      hash ^= message.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  // Optional: Method to update the floating message from elsewhere
  setFloatingUpdate(message: string) {
    this.floatingUpdateMessage.set(message);
    // Clear the dismissal for this new message
    try {
      const key = `floatingUpdate_v2:${this.hashMessage(message)}`;
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Could not access localStorage');
    }
    this.showFloatingUpdate.set(true);
  }

  onSelectPreset(preset: { id: number; title: string; description: string }): void {
    this.selectedPreset.set(preset.title);
    this.activeHistoryItem.set(null);

  // Show only title in prompt box
    this.prompt.set(preset.title);

  // Store full preset internally so generation still uses description
    (this as any)._internalPreset = preset;
  }

  onPromptInput(value: string): void {
    this.prompt.set(value);

    const selected = this.selectedPreset();
    if (selected && value !== selected) {
      this.selectedPreset.set(null);
      (this as any)._internalPreset = null;
    }
  }

  onFileChange(fileList: FileList | null): void {
    const file = fileList && fileList.length ? fileList.item(0) : null;
    if (!file) {
      this.clearFile();
      return;
    }
    const type = file.type.toLowerCase();
    const isValid = type === 'image/jpeg' || type === 'image/png' || type === 'image/jpg';
    if (!isValid) {
      this.clearFile();
      alert('Please upload a JPG or PNG image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Extract the base64 data part (after 'data:image/jpeg;base64,')
      const dataPart = base64.split(',')[1];
      this.base64Image.set(dataPart)
    }

    reader.readAsDataURL(file);

    // Create preview URL (SSR-safe)
    if (typeof window !== 'undefined' && 'URL' in window) {
      const url = URL.createObjectURL(file);
      this.filePreviewUrl.set(url);
    }
  }

  private clearFile(): void {
    // Revoke previous URL
    const current = this.filePreviewUrl();
    if (typeof window !== 'undefined' && current) {
      try { URL.revokeObjectURL(current); } catch { /* noop */ }
    }
    this.file.set(null);
    this.filePreviewUrl.set(null);
  }

  async generate(): Promise<void> {
    if (!this.canGenerate()) return;
    this.loading.set(true);
    this.resultUrl.set(null);

    // Start cycling through loading messages every second
    this.loadingMessagesService.startCycling();

    const currentPrompt = this.prompt().trim();

    const fullPrompt = (this as any)._internalPreset
      ? (this as any)._internalPreset.description
      : this.prompt();

    this.aiService.generateContent(fullPrompt, this.base64Image()!)
      .then(async res => {
        // Stop message cycling
        this.loadingMessagesService.stopCycling();

        this.resultUrl.set(res);
        this.loading.set(false);

        // Persist prompt to user history via service
      })
      .catch(error => {
        // Stop message cycling on error as well
        this.loadingMessagesService.stopCycling();
        this.loading.set(false);
        console.error('Generation failed:', error);
      })
  }

  downloadResult(event: Event): void {
    const url = this.resultUrl();
    if (!url) return;

    const anchor = event.currentTarget as HTMLAnchorElement;
    const isDataUrl = url.startsWith("data:");
    const randomFilename = "nano-" + Math.random().toString(36).substring(2, 10) + ".png";

  // iOS detection
    const isIOS =
      typeof navigator !== "undefined" &&
      /iP(hone|od|ad)/.test(navigator.userAgent);

    if (isIOS) {
      event.preventDefault();
      try {
        const blob = isDataUrl ? this.dataUrlToBlob(url) : null;

        if (blob && navigator.share) {
          const file = new File([blob], randomFilename, { type: blob.type });
          navigator.share({ files: [file] }).catch(() => {
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, "_blank");
            setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
          });
          return;
        }

        const openUrl = blob ? URL.createObjectURL(blob) : url;
        window.open(openUrl, "_blank");
        if (blob) setTimeout(() => URL.revokeObjectURL(openUrl), 30000);
      } catch {
        window.open(url, "_blank");
      }
      return;
    }

  // Desktop / Android
    if (isDataUrl) {
      const blob = this.dataUrlToBlob(url);
      const blobUrl = URL.createObjectURL(blob);
      anchor.href = blobUrl;
      anchor.download = randomFilename;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } else {
      anchor.download = randomFilename;
    }
  }

  // Fixed method - moved before downloadResult and fixed syntax
  private dataUrlToBlob(dataUrl: string): Blob {
    const [meta, base64] = dataUrl.split(',');
    const mimeMatch = /data:([^;]+);base64/.exec(meta);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
}
