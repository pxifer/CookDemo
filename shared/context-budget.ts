// Application-side estimate for budgeting only; provider usage is authoritative.
// This is deliberately conservative for Chinese and is not a model tokenizer.
export function estimatedTokens(text:string):number {
  let units=0;
  for(const character of text)units+=/\p{Script=Han}/u.test(character)?2:/[\x00-\x7f]/.test(character)?.4:2;
  return Math.ceil(units);
}

export const selectionInputBudget=24000;
