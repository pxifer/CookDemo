import React, { useState } from 'react';
import type { Recipe } from '../../shared/types';

export function RecipePhoto({recipe,detail=false}:{recipe:Recipe;detail?:boolean}) {
  return <DishImage name={recipe.name} src={recipe.imageUrl} className={detail?'detail-photo':undefined}
    fallback={<div className={`recipe-photo-pending ${detail?'detail-photo':''}`} role="img" aria-label={recipe.name}><span>SHIWEI KITCHEN</span><strong>{recipe.name}</strong></div>}/>;
}

/** A failed asset must never be replaced with a different dish. Retry when its URL changes. */
export function DishImage({name,src,className,fallback}:{name:string;src?:string|null;className?:string;fallback:React.ReactNode}) {
  const [failed,setFailed]=useState<string|null>(null);
  const [originalOnly,setOriginalOnly]=useState<string|null>(null);
  const optimized=!!src&&(src.startsWith('/assets/recipes/')||src.startsWith('https://shiwei-d2gmiun66b7dc6a4f-1512010497.tcloudbaseapp.com/assets/recipes/'))&&src.endsWith('.png')&&src!==originalOnly;
  return src&&src!==failed?<img className={className} src={src} srcSet={optimized?src.replace(/\.png$/,'.webp'):undefined}
    alt={`${name}图片`} loading="lazy" decoding="async" onError={()=>optimized?setOriginalOnly(src):setFailed(src)}/>:<>{fallback}</>;
}
