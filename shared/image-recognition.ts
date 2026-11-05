import type { Extraction } from './types';

export interface ImageRecognitionRequest { operationId: string; image: string; contentVersion?: string }
export interface ImageRecognitionResult { operationId: string; extraction: Extraction; uncertain: string[] }
export const imageRecognitionSchema = { type:'object', additionalProperties:false, required:['operationId','image'], properties:{
  operationId:{type:'string',format:'uuid'}, image:{type:'string',maxLength:2800000,pattern:'^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'}, contentVersion:{type:'string',maxLength:160},
} } as const;
