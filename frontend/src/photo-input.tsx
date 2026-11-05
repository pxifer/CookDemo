import React, { useEffect, useRef, useState } from 'react';
import { recognizePhoto } from './api';
import type { Extraction } from '../../shared/types';
import type { ImageRecognitionResult } from '../../shared/image-recognition';

export function PhotoInput({onAdd,provider='deepseek',userId,configured,version}:{onAdd:(data:Extraction)=>void;provider?:'deepseek'|'zhipu';userId?:string;configured:boolean;version:number}) {
  const gallery=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),request=useRef<AbortController|null>(null),sequence=useRef(0);
  const [photo,setPhoto]=useState<{url:string;file:File}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [result,setResult]=useState<ImageRecognitionResult|null>(null),[selected,setSelected]=useState<string[]>([]);
  const invalidate=()=>{sequence.current++;request.current?.abort();request.current=null;setBusy(false);setResult(null);setSelected([]);};
  useEffect(()=>()=>{sequence.current++;request.current?.abort();},[]);
  useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo.url);},[photo]);
  useEffect(()=>{invalidate();setError('');},[userId,version,provider,configured]);
  const choose=(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('请选择 JPG、PNG 或 WebP 图片，原预览已保留。');return;}
    if(file.size>5*1024*1024){setError('图片请控制在 5 MiB 以内，原预览已保留。');return;}
    invalidate();setError('');setPhoto({url:URL.createObjectURL(file),file});
  };
  const recognize=async()=>{
    if(!photo||busy||request.current)return;
    const controller=new AbortController();request.current=controller;const attempt=++sequence.current;
    setBusy(true);setError('');setResult(null);setSelected([]);
    const timer=setTimeout(()=>controller.abort(),24000);
    try{
      // Re-encode pixels to strip metadata and bound upload dimensions.
      const bitmap=await createImageBitmap(photo.file).catch(()=>{throw Error('图片无法读取，请重新选择 JPG、PNG 或 WebP 图片');});let image:string;
      try{const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw Error('当前浏览器无法处理图片');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);image=canvas.toDataURL('image/jpeg',0.85);}finally{bitmap.close();}
      if(controller.signal.aborted||sequence.current!==attempt)return;
      if(image.length>2800000)throw Error('处理后的图片仍过大，请裁剪后重试');
      const data=await recognizePhoto(image,crypto.randomUUID(),controller.signal);
      if(sequence.current!==attempt)return;
      setResult(data);setSelected(data.extraction.ingredients.map(item=>item.id));
    }catch(e){if(sequence.current===attempt)setError(controller.signal.aborted?'识别已取消或超时，未自动重试。':(e as Error).message);}
    finally{clearTimeout(timer);if(sequence.current===attempt){request.current=null;setBusy(false);}}
  };
  return <div className="photo-input">
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择食材图片" hidden onChange={choose}/>
    <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="拍摄食材图片" hidden onChange={choose}/>
    <span className="upload-buttons"><button className="mini-button" onClick={()=>gallery.current?.click()}>选择图片</button><button className="camera-button" onClick={()=>camera.current?.click()}>手机拍照</button></span>
    <p className="small">{provider==='zhipu'?'使用智谱免费视觉模型。':'与健康模式共用已保存的 DeepSeek Key，识别按模型用量计费。'}点击识别时上传图片，本站不保存照片；结果请核对后添加。</p>
    {!userId&&<p className="small">请先登录，再使用图片识别。</p>}
    {userId&&provider==='deepseek'&&!configured&&<p className="small">请在个人设置中保存 DeepSeek API Key。</p>}
    {error&&<p role="alert">{error}</p>}
    {photo&&<><div className="photo-preview"><img src={photo.url} alt="本次食材图片预览" onError={()=>{invalidate();setPhoto(null);setError('图片无法打开，请重新选择。');}}/><span>{photo.file.name}</span><button onClick={()=>{invalidate();setPhoto(null);setError('');}}>移除图片</button></div>
      <button className="button outline" disabled={busy||!userId||provider==='deepseek'&&!configured} onClick={()=>void recognize()}>{busy?'正在识别…':'识别食材'}</button>
      {busy&&<button onClick={()=>{invalidate();setError('已取消，图片保留。');}}>取消识别</button>}
    </>}
    {result&&<div aria-live="polite"><p>{result.extraction.ingredients.length?'请核对识别到的食材，可取消不正确的项。':'没有识别到明确食材，请换张图片或手动添加。'}</p><ul className="photo-candidates">{result.extraction.ingredients.map(item=><li key={item.id}><label><input type="checkbox" checked={selected.includes(item.id)} onChange={event=>setSelected(values=>event.target.checked?[...values,item.id]:values.filter(id=>id!==item.id))}/>{item.name}</label></li>)}</ul>
      {result.uncertain.length>0&&<p>无法确定，未加入清单：{result.uncertain.join('、')}</p>}
      {!!result.extraction.ingredients.length&&<button className="button outline" disabled={!selected.length} onClick={()=>{onAdd({...result.extraction,ingredients:result.extraction.ingredients.filter(item=>selected.includes(item.id))});invalidate();}}>添加所选食材</button>}
    </div>}
  </div>;
}
