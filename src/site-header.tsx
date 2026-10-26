import React from 'react';

export function SiteHeader({ page, count, settings, signedIn = false }: {
  page: 'workspace' | 'recipes' | 'favorites'; count?: number; settings?: () => void; signedIn?: boolean;
}) {
  return <header className="site-header unified-header">
    <a href="/" className="brand" aria-label="拾味首页"><span className="brand-mark">拾</span><span>拾味<small>SHIWEI KITCHEN</small></span></a>
    <nav aria-label="主导航">{([
      ['workspace', '/#workspace', '做饭工作台'], ['recipes', '/recipes', '菜谱图鉴'], ['favorites', '/favorites', '我的收藏'],
    ] as const).map(([id, href, label]) => <a key={id} href={href} className={`nav-item${page === id ? ' active' : ''}`} aria-current={page === id ? 'page' : undefined}>{label}{id === 'favorites' && count !== undefined && <span id="favorite-count">{count}</span>}</a>)}</nav>
    <div className="header-actions">{settings ? <button className={`avatar${signedIn ? ' signed-in' : ''}`} aria-label="个人设置" onClick={settings}>我</button> : <a href="/?settings=1" className="avatar" aria-label="个人设置">我</a>}</div>
  </header>;
}
