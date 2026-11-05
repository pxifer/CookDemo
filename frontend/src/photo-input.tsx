import React, { useEffect, useRef, useState } from 'react';

export function PhotoInput() {
  const gallery = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('请选择 JPG、PNG 或 WebP 图片，原预览已保留。'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('图片请控制在 5 MiB 以内，原预览已保留。'); return; }
    setError(''); setPhoto({ url: URL.createObjectURL(file), name: file.name });
  };
  return <div className="photo-input">
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择食材图片" hidden onChange={choose}/>
    <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="拍摄食材图片" hidden onChange={choose}/>
    <span className="upload-buttons"><button className="mini-button" onClick={() => gallery.current?.click()}>选择图片</button><button className="camera-button" onClick={() => camera.current?.click()}>手机拍照</button></span>
    <p className="small">图片仅在本页预览；识别暂不可用，请用文字或手动添加食材。手机拍照由设备支持情况决定。</p>
    {error && <p role="alert">{error}</p>}
    {photo && <div className="photo-preview"><img src={photo.url} alt="本次食材图片预览" onError={() => { setPhoto(null); setError('图片无法打开，请重新选择。'); }}/><span>{photo.name}</span><button onClick={() => { setPhoto(null); setError(''); }}>移除图片</button></div>}
  </div>;
}
