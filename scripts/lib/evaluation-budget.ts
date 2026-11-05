export interface VerifiedPricing {model:'deepseek-flash';currency:'CNY';inputPerMillion:number;outputPerMillion:number;verifiedDate:string;source:string}
export class EvaluationBudget {
  private reserved=0;
  constructor(readonly maximumCny:number,readonly pricing:VerifiedPricing,today:string){
    if(!Number.isFinite(maximumCny)||maximumCny<=0||maximumCny>5||pricing.model!=='deepseek-flash'||pricing.currency!=='CNY'||pricing.verifiedDate!==today||!/^https:\/\/api-docs\.deepseek\.com\//.test(pricing.source)||![pricing.inputPerMillion,pricing.outputPerMillion].every(v=>Number.isFinite(v)&&v>0))throw Error('EVALUATION_PRICING_NOT_VERIFIED');
  }
  restoreReserved(microCny:number){if(!Number.isSafeInteger(microCny)||microCny<0)throw Error('EVALUATION_BUDGET_LEDGER_INVALID');this.reserved=microCny;}
  reserve(inputBytes:number,maxOutputTokens:number){
    if(!Number.isSafeInteger(inputBytes)||inputBytes<0||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1)throw Error('EVALUATION_BUDGET_INPUT_INVALID');
    // UTF-8 bytes plus protocol allowance is an application-side upper estimate,
    // not a provider tokenizer or an account-wide billing guarantee.
    const amount=Math.ceil((inputBytes+4096)*this.pricing.inputPerMillion+maxOutputTokens*this.pricing.outputPerMillion);
    if(this.reserved+amount>Math.floor(this.maximumCny*1_000_000))throw Error('EVALUATION_BUDGET_EXHAUSTED');
    this.reserved+=amount;return amount;
  }
  get reservedMicroCny(){return this.reserved;}
}
