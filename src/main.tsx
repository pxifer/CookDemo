import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { categories, diseaseAliases, findFood, foodById, foods, recipes } from '../shared/catalog';
import { makeRestriction } from '../shared/extraction';
import { amountParts, inputIngredient, mergeInput, normalizeInput, seasoningIds, setAmount, units } from './meal-input';
import { type Dish, type Extraction, type Favorite, type Ingredient, type Meal, type QuantityCheck, type Recipe, type RecommendationRequest, type RecommendationResult, type Variant } from '../shared/types';
import { establishSession, extract, loginForLocalTest, logout, requestRecommendation } from './api';
import type { SessionInfo } from '../shared/session';
import { compositionError, inputMode, servingReference, servingReferences } from '../shared/meal-planning';
import { validateMeal } from './meal-validator.js';
import { readFavorites, readMeal, STORAGE_KEY, writeMeal, writeValue } from './storage';
import './demo.css';
import './styles.css';
import './product.css';

const labels = { meat: '荤菜', veg: '素菜', soup: '汤品' };
const fresh = () => crypto.randomUUID();
const favoriteKey = (f: Favorite) => `${f.recipeId}:${f.variantId}`;
const friendly = (text: string) => text.replace(/此构造目录内/g, '暂时').replace(/同名食材数量或计量基准冲突，请逐项核对/g, '同一种食材有两个不同用量，请选择要使用的用量').replace(/请至少确认一种现有食材/g, '请先添加一种食材；找不到时可以换个名称').replace(/请核对限制：/g, '请确认饮食要求：').replace(/真实账户与经审核的健康规则尚未准入，当前不提供健康推荐。可主动返回普通模式，过敏与忌口继续生效。/g, '健康推荐暂不可用，请使用普通模式。过敏和忌口仍会生效。');
function Modal({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    return () => {
      el.close();
      queueMicrotask(() => {
        if (trigger?.isConnected && !document.querySelector('dialog[open]')) trigger.focus({ preventScroll: true });
      });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="modal-top modal-header"><h2 id="modal-title">{title}</h2><button onClick={close} aria-label="关闭弹层" className="icon-button">×</button></div><div className="modal-content">{children}</div>
  </dialog>;
}
function FavoriteControl({ recipe, variant, active, toggle, compact = false }: { recipe: Recipe; variant: Variant; active: boolean; toggle: () => void; compact?: boolean }) {
  return <button type="button" className={compact ? 'favorite-button' : 'detail-favorite'} aria-pressed={active} aria-label={`${active ? '取消收藏' : '收藏'} ${recipe.name}${compact ? '' : ` ${variant.flavor}`}`} onClick={toggle}>
    <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>
    {!compact && <span>{active ? '已收藏 · 点击取消' : '收藏此口味'}</span>}
  </button>;
}
function CheckList({ checks }: { checks: QuantityCheck[] }) {
  return <ul className="checks">{checks.map(c => <li key={c.foodId} className={c.state === 'shortage' || c.state === 'missing' ? 'warning' : ''}>
    <strong>{c.name}</strong> · {c.state === 'enough' ? `已有 ${c.available}${c.unit}，需要 ${c.needed}${c.unit}` : c.state === 'shortage' ? `还需 ${c.shortage}${c.unit}（已有 ${c.available}，需要 ${c.needed}）` : c.state === 'missing' ? c.unit === '有无' ? '缺少必需调味料' : `需补买 ${c.needed}${c.unit}` : '请按菜谱参考用量准备'}
  </li>)}</ul>;
}
function App() {
  const [meal, setMeal] = useState<Meal>(() => normalizeInput(readMeal()));
  const mealRef = useRef(meal); mealRef.current = meal;
  const [favorites, setFavorites] = useState<Favorite[]>(readFavorites);
  const favoritesRef = useRef(favorites); favoritesRef.current = favorites;
  const [favoriteFeedback, setFavoriteFeedback] = useState('');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [loginReturn, setLoginReturn] = useState<'account' | 'health'>('account');
  const [diseaseText, setDiseaseText] = useState('');
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState(''); const [storageError, setStorageError] = useState(false);
  const [crossTab, setCrossTab] = useState(false);
  const [entryOpen, setEntryOpen] = useState(() => readMeal().ingredients.length === 0);
  const [tab, setTab] = useState<'text' | 'image'>('image');
  const [countsOpen, setCountsOpen] = useState(false);
  const [modal, setModal] = useState<'favorites' | 'health' | 'account' | 'login' | 'allergy' | 'avoid' | 'seasonings' | 'guide' | null>(null);
  const [detail, setDetail] = useState<{ recipe: Recipe; variant: Variant; checks?: QuantityCheck[]; nutrition?: Dish['nutrition']; message?: string } | null>(null);
  const [restrictionText, setRestrictionText] = useState('');
  const [restrictionScope, setRestrictionScope] = useState<'self' | 'additional'>('self');
  const [manualName, setManualName] = useState('');
  const controller = useRef<AbortController | null>(null); const operation = useRef('');
  const resultRef = useRef<HTMLElement>(null);
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  useEffect(() => { const observer = new IntersectionObserver(([entry]) => setWorkspaceVisible(entry.isIntersecting)); const el = document.getElementById('workspace'); if (el) observer.observe(el); return () => observer.disconnect(); }, []);
  useEffect(() => { void establishSession().then(setSessionInfo).catch(e => setNotice(e.message)); return () => controller.current?.abort(); }, []);
  useEffect(() => { if (!crossTab) setStorageError(!writeMeal(meal)); }, [meal, crossTab]);
  useEffect(() => {
    const handle = (event: StorageEvent) => { if (event.key === STORAGE_KEY) { controller.current?.abort(); operation.current = ''; setBusy(false); setResult(null); setCrossTab(true); } };
    window.addEventListener('storage', handle); return () => window.removeEventListener('storage', handle);
  }, []);
  const edit = (change: Partial<Meal> | ((m: Meal) => Meal)) => {
    controller.current?.abort(); operation.current = ''; setBusy(false); setResult(null);
    const previous = mealRef.current;
    const updated = typeof change === 'function' ? change(previous) : { ...previous, ...change };
    const next = { ...updated, counts: updated.composition === 'auto' ? { ...servingReference(updated.servings).counts } : updated.counts, mode: inputMode(updated), version: previous.version + 1 };
    mealRef.current = next; setMeal(next); return next;
  };
  const ingredient = (id: string, fields: Partial<Ingredient>) => edit(m => ({ ...m, ingredients: m.ingredients.map(i => i.id === id ? { ...i, ...fields } : i) }));
  const active = meal.restrictions.filter(r => r.scope === 'self' || meal.includeAdditional);
  const pending = active.filter(r => r.status !== 'confirmed');
  const addParsed = (data: Extraction) => {
    const parsed = data.ingredients.filter(i => !i.foodId || !seasoningIds.includes(i.foodId));
    const added = mergeInput(mealRef.current.ingredients, parsed);
    const restrictions = [...mealRef.current.restrictions, ...data.restrictions.filter(n => !mealRef.current.restrictions.some(r => r.kind === n.kind && r.name === n.name && r.scope === n.scope)), ...data.unresolved.map(s => makeRestriction(`未分类：${s}`, 'unclassified'))];
    if (added.length > 100 || restrictions.length > 50) { setNotice('食材最多 100 种，饮食要求最多 50 项，请分次整理；原输入已保留'); return; }
    edit(m => ({ ...m, ingredients: added,
      restrictions,
      diseases: [...new Set([...m.diseases, ...data.diseases])].slice(0, 20), servings: data.servings ?? m.servings }));
    if (parsed.length) setEntryOpen(false);
    setNotice(data.restrictions.length || data.unresolved.length ? '食材已加入。请分别打开过敏或忌口，确认新识别的饮食要求。' : data.ingredients.length !== parsed.length ? '食材已加入，调料请在调料设置中管理。' : parsed.length ? '食材已加入，可以开始搭配了' : '没有找到食材，可以在下方手动添加');
  };
  const organize = async () => {
    if (!meal.raw.trim()) { setNotice('先写下手边的食材吧'); return; }
    const snapshot = mealRef.current.version;
    try { const data = await extract(meal.raw); if (snapshot === mealRef.current.version) addParsed(data); }
    catch (e) { setNotice((e as Error).message); }
  };
  const addManual = () => {
    const name = manualName.trim(); if (!name) return;
    if (meal.ingredients.length >= 100) { setNotice('最多添加 100 种食材，请先移除不需要的食材'); return; }
    const item = inputIngredient(name);
    if (item.foodId && seasoningIds.includes(item.foodId)) { setNotice('调料请在「调料」中选择，食材清单只放这餐要做的食材'); return; }
    edit(m => ({ ...m, ingredients: mergeInput(m.ingredients, [item]) })); setManualName(''); setEntryOpen(false);
  };
  const showSettings = (kind: 'allergy' | 'avoid') => { setNotice(''); setRestrictionText(''); setRestrictionScope('self'); setModal(kind); };
  const addRestriction = () => {
    const name = restrictionText.trim(); if (!name || (modal !== 'allergy' && modal !== 'avoid')) return;
    if (meal.restrictions.length >= 50) { setNotice('最多保存 50 项饮食要求，请先移除不需要的项目'); return; }
    const restriction = makeRestriction(name, modal, restrictionScope);
    const category = categories.some(c => c.name === name || c.aliases.includes(name));
    if (restriction.targets.length && !category) restriction.status = 'confirmed';
    edit(m => ({ ...m, restrictions: m.restrictions.some(r => r.kind === restriction.kind && r.name === name && r.scope === restriction.scope) ? m.restrictions : [...m.restrictions, restriction] }));
    setRestrictionText('');
  };
  const generate = async (action: RecommendationRequest['action'] = 'generate', extra: Partial<RecommendationRequest> = {}, snapshot = mealRef.current) => {
    if (snapshot.health && sessionInfo?.localTestFeatures && sessionInfo.identity !== 'local-test') { setLoginReturn('health'); setAuthMessage('请先登录，再继续健康模式测试'); setModal('login'); return; }
    if (crossTab) { setNotice('另一页面修改了本餐，请先选择要保留的内容'); return; }
    if (!Number.isInteger(snapshot.servings) || snapshot.servings < 1 || snapshot.servings > 12) { setNotice('人数须为 1～12 的整数'); document.getElementById('servings')?.focus(); return; }
    const countError = compositionError(snapshot);
    if (countError) { setCountsOpen(true); setNotice(countError); return; }
    controller.current?.abort(); const aborter = new AbortController(); controller.current = aborter;
    const operationId = fresh(); operation.current = operationId;
    setBusy(true); setNotice(''); setProgress('正在提交本餐条件');
    const body: RecommendationRequest = { operationId, meal: snapshot, action, page: 0, previous: result?.dishes.map(d => d.recipe.id) ?? [], selected: result?.dishes.map(d => ({ recipeId: d.recipe.id, variantId: d.variant.id })) ?? [], ...extra };
    try {
      const next = await requestRecommendation(body, aborter.signal, () => setProgress('正在挑选菜谱并检查搭配…'));
      if (operation.current !== operationId || mealRef.current.version !== snapshot.version) return;
      if (!next.changed && result) setNotice(next.reasons.map(friendly).join('；'));
      else { setResult(next); resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } catch (e) { if (!aborter.signal.aborted && operation.current === operationId) setNotice((e as Error).message); }
    finally { if (operation.current === operationId) setBusy(false); }
  };
  const saveDefault = () => {
    if (pending.length) { setNotice('请先确认过敏和忌口，再保存常用偏好'); return; }
    const defaults = { ...meal, ingredients: [], raw: '', overrides: {}, includeAdditional: false, version: 0 };
    if (!validateMeal(defaults)) { setNotice('请检查人数和菜品数量后再保存'); return; }
    setNotice(writeValue('shiwei:guest:defaults:v1', defaults) ? '已保存常用偏好，下次开始新一餐时会使用' : '浏览器未允许保存，本次修改仍在当前页面');
  };
  const newMeal = () => { edit(normalizeInput(readMeal('shiwei:guest:defaults:v1'))); setEntryOpen(true); setNotice('已开始新一餐，常用偏好和收藏会保留'); };
  const isFavorite = (recipe: Recipe, variant: Variant) => favorites.some(f => f.recipeId === recipe.id && f.variantId === variant.id);
  const toggleFavorite = (recipe: Recipe, variant: Variant) => {
    const f = { recipeId: recipe.id, variantId: variant.id }, key = favoriteKey(f);
    const current = favoritesRef.current;
    const existed = current.some(v => favoriteKey(v) === key);
    const next = existed ? current.filter(v => favoriteKey(v) !== key) : [...current, f];
    const saved = writeValue('shiwei:guest:favorites:v1', next);
    favoritesRef.current = next; setFavorites(next);
    const message = `${existed ? '已取消收藏' : '已收藏'}：${recipe.name} · ${variant.flavor}${saved ? '' : '（当前页面有效，浏览器未允许保存）'}`;
    setFavoriteFeedback(message); if (!detail) setNotice(message);
    if (!saved) setStorageError(true);
  };
  const login = async () => {
    setAuthBusy(true); setAuthMessage('');
    try {
      const current = await loginForLocalTest(); setSessionInfo(current); setAuthMessage('');
      if (loginReturn === 'health') { edit({ health: true }); setModal(null); setNotice('已登录并开启健康模式测试'); }
      else { setModal('account'); setNotice('已进入本机测试账号'); }
    }
    catch (e) { setAuthMessage((e as Error).message); }
    finally { setAuthBusy(false); }
  };
  const signOut = async () => {
    setAuthBusy(true); setAuthMessage('');
    controller.current?.abort(); operation.current = ''; setBusy(false); setResult(null);
    try { const current = await logout(); setSessionInfo(current); edit({ health: false }); setAuthMessage('已退出登录，本餐食材和收藏保留'); }
    catch (e) { setAuthMessage((e as Error).message); }
    finally { setAuthBusy(false); }
  };
  const enableHealth = () => {
    if (sessionInfo?.identity !== 'local-test') { setLoginReturn('health'); setAuthMessage(''); setModal('login'); return; }
    edit({ health: true }); setModal(null); setNotice('健康模式测试已开启');
  };
  const openFavorite = async (f: Favorite) => {
    const recipe = recipes.find(r => r.id === f.recipeId), variant = recipe?.variants.find(v => v.id === f.variantId);
    if (!recipe || !variant) { setNotice('收藏内容已变化或停用，请重新选择'); return; }
    setModal(null); setFavoriteFeedback('');
    setDetail({ recipe, variant, message: '正在按当前食材与饮食要求重新核对…' });
    const snapshot = mealRef.current.version;
    try {
      const m = { ...mealRef.current, servings: 1, composition: 'auto' as const, counts: { ...servingReference(1).counts }, mode: 'meal' as const, overrides: { ...mealRef.current.overrides, [recipe.id]: variant.id } };
      const checked = await requestRecommendation({ operationId: fresh(), meal: m, action: 'variant', selected: [f], page: 0, previous: [] }, new AbortController().signal, () => {});
      if (snapshot !== mealRef.current.version) return;
      const dish = checked.dishes.find(d => d.recipe.id === recipe.id);
      setDetail({ recipe, variant, checks: dish?.checks, nutrition: dish?.nutrition, message: dish ? '已按当前食材与饮食要求复查；仍须留意数量未核实项' : checked.reasons.map(friendly).join('；') });
    } catch (e) { setDetail({ recipe, variant, message: `当前适用性无法核验：${(e as Error).message}` }); }
  };
  const changeVariant = (dish: Dish, variantId: string) => {
    const selected = result!.dishes.map(d => ({ recipeId: d.recipe.id, variantId: d.variant.id }));
    const snapshot = edit({ overrides: { ...meal.overrides, [dish.recipe.id]: variantId } });
    void generate(meal.mode === 'meal' ? 'variant' : 'generate', { selected }, snapshot);
  };
  const deleteRestriction = (id: string) => edit(m => ({ ...m, restrictions: m.restrictions.filter(r => r.id !== id) }));
  const nav = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return <>
    <a className="skip" href="#workspace">跳到本餐工作台</a>
    <header className="site-header"><a href="#" className="brand" aria-label="拾味首页"><span className="brand-mark">拾</span><span>拾味<small>SHIWEI KITCHEN</small></span></a>
      <nav aria-label="主导航"><button onClick={() => nav('workspace')} className="nav-item active">做饭工作台</button><button className="nav-item" onClick={() => setModal('favorites')}>我的收藏 <span id="favorite-count">{favorites.length}</span></button></nav>
      <div className="header-actions"><button className={`avatar ${sessionInfo?.identity === 'local-test' ? 'signed-in' : ''}`} title={sessionInfo?.displayName ?? '个人设置'} aria-label="个人设置" onClick={() => (setNotice(''), setModal('account'))}>我</button></div></header>
    <main>
      <section className="page-intro"><div><div className="eyebrow">A LITTLE INSPIRATION, EVERY DAY</div><h1>今天，吃点什么？<span className="sun-icon" aria-hidden="true">✳</span></h1><p>打开冰箱，把手边的食材变成一顿好饭。</p></div><button className="health-entry" onClick={() => (setAuthMessage(''), setModal('health'))}><span className="health-symbol" aria-hidden="true">♡</span><span><strong>健康模式</strong><small>{meal.health ? '已开启 · 本机测试' : sessionInfo?.localTestFeatures ? '登录后开启测试' : '了解健康推荐'}</small></span><span className={`switch ${meal.health ? 'on' : ''}`} aria-hidden="true"/></button></section>
      <section className="hero-banner"><div className="hero-copy"><span className="hero-tag"><i/> 少一点纠结，多一点烟火气</span><h2>有啥，做啥。<br/>好好吃一餐。</h2><p>食材不浪费，搭配刚刚好。</p></div><div className="hero-photo" role="img" aria-label="番茄炒蛋、时蔬和汤的家常餐食示意"><div className="photo-note">家常滋味 · 图片为示意</div></div><span className="hero-doodle" aria-hidden="true">✳</span></section>
      {crossTab && <div className="warning-box" role="alert">另一页面更新了这一餐，请选择使用哪份内容。<div className="actions"><button onClick={() => { const restored = normalizeInput(readMeal()); setCrossTab(false); edit(restored); }}>载入另一页面版本</button><button onClick={() => { setCrossTab(false); edit({}); }}>保留当前编辑并写回</button></div></div>}
      {storageError && <p role="alert" className="warning-box">浏览器未允许本机保存。当前页面可继续，刷新可能无法恢复。</p>}
      <div id="workspace" className="workspace"><div className="input-column"><section className="panel ingredient-panel"><div className="section-heading"><h2><span className="step-number">01</span>看看有什么食材</h2><span className="subtle">{meal.ingredients.length} 种</span></div>
          <div className="input-tabs" role="group" aria-label="输入方式"><button className={tab === 'image' ? 'selected' : ''} aria-pressed={tab === 'image'} onClick={() => { setTab('image'); setEntryOpen(true); }}>拍照 / 上传</button><button className={tab === 'text' ? 'selected' : ''} aria-pressed={tab === 'text'} onClick={() => { setTab('text'); setEntryOpen(true); }}>文字输入</button></div>
          {entryOpen && (tab === 'text' ? <><label className="sr-only" htmlFor="raw">输入食材与本餐信息</label><textarea id="raw" maxLength={5000} value={meal.raw} onChange={e => edit({ raw: e.target.value })} placeholder="例如：西红柿2个鸡蛋3个菠菜一把，2个人吃，对虾过敏"/><button className="button outline full organize-button" onClick={() => void organize()}>整理信息 ↗</button></> : <div className="upload-zone"><span className="upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="16" cy="9" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/></svg></span><strong>拍下食材，灵感就来了</strong><span>图片识别暂不可用，请使用文字或手动添加</span><span className="upload-buttons"><button className="mini-button" disabled>选择图片</button><button className="camera-button" disabled>手机拍照</button></span><button className="text-button" onClick={() => { setTab('text'); setEntryOpen(true); }}>转到文字录入 →</button></div>)}
          <div className="ingredient-heading list-label"><strong>我的食材</strong><span>用量选填</span></div>
          <p className="amount-hint">填写用量，搭配菜数和补买建议会更精确。</p>
          {!meal.ingredients.length && <div className="ingredient-empty">把这餐想做的食材加进来吧</div>}
          <ul className="ingredients" aria-label="我的食材">{meal.ingredients.map(i => { const amount = amountParts(i); return <li key={i.id}><div className="ingredient-row">
            <span className="ingredient-name" title={i.name}>{i.name}</span>
            <input aria-label={`${i.name}用量`} inputMode="decimal" maxLength={80} value={amount.value} placeholder="选填" onChange={e => ingredient(i.id, setAmount(i, e.target.value, amount.unit))}/>
            <select aria-label={`${i.name}单位`} value={amount.unit} onChange={e => ingredient(i.id, setAmount(i, amount.value, e.target.value))}>{units.map(unit => <option key={unit}>{unit}</option>)}</select>
            <button className="icon-button" aria-label={`删除食材 ${i.name}`} onClick={() => edit(m => ({ ...m, ingredients: m.ingredients.filter(x => x.id !== i.id) }))}>×</button></div>
            {i.status === 'conflict' && <div className="quantity-conflict"><p>已有用量 {i.amount || '未填'}，新输入 {i.alternative}，这次用哪个？</p><button onClick={() => ingredient(i.id, { status: i.foodId ? 'confirmed' : 'pending', alternative: undefined })}>保留原用量</button><button onClick={() => ingredient(i.id, { amount: i.alternative ?? '', status: i.foodId ? 'confirmed' : 'pending', alternative: undefined })}>使用新用量</button></div>}
          </li>; })}</ul>
          <form className="manual-add" onSubmit={e => { e.preventDefault(); addManual(); }}><input aria-label="手动添加食材" list="food-names" maxLength={100} value={manualName} onChange={e => setManualName(e.target.value)} placeholder="手动添加食材…"/><button className="text-button" disabled={!manualName.trim()}>＋ 添加</button></form>
          <datalist id="food-names">{foods.filter(f => !seasoningIds.includes(f.id)).map(f => <option key={f.id} value={f.name}/>)}</datalist>
        </section>
        <section className="panel preferences"><div className="section-heading"><h2><span className="step-number">02</span>这一餐的偏好</h2><button className="text-button" onClick={() => (setNotice(''), setModal('account'))}>常用偏好 ↗</button></div>
          <div className="setting-row"><div className="servings-label"><label htmlFor="servings">几个人吃</label><button className="serving-guide-link" aria-label={`${meal.servings || 1} 人配菜参考 · 查看人数表`} onClick={() => setModal('guide')}>配菜参考 ↗</button></div><div className="stepper"><button aria-label="减少人数" onClick={() => edit({ servings: Math.max(1, (meal.servings || 1) - 1) })}>−</button><input id="servings" type="number" min="1" max="12" step="1" value={Number.isNaN(meal.servings) ? '' : meal.servings} onChange={e => edit({ servings: e.target.value === '' ? NaN : Number(e.target.value) })}/><button aria-label="增加人数" onClick={() => edit({ servings: Math.min(12, (meal.servings || 1) + 1) })}>＋</button></div></div>
          {(!Number.isInteger(meal.servings) || meal.servings < 1 || meal.servings > 12) && <p role="alert" className="warning">人数须为 1～12 的整数</p>}
          <fieldset className="flavor-setting"><legend>今天的口味</legend><div className="chips flavor-options">{['不限', '清淡', '微辣'].map(f => <button className={`flavor-button ${meal.flavor === f ? 'active' : ''}`} key={f} aria-pressed={meal.flavor === f} onClick={() => edit({ flavor: f })}>{f}</button>)}</div></fieldset>
          <div className="preference-shortcuts">{(['allergy', 'avoid'] as const).map(kind => { const list = active.filter(r => r.kind === kind || (kind === 'avoid' && r.kind === 'unclassified')); return <button key={kind} onClick={() => showSettings(kind)}><span>{kind === 'allergy' ? '过敏' : '忌口'}</span><small>{list.length ? `${list.length} 项${list.some(r => r.status !== 'confirmed') ? ' · 待确认' : ''}` : '未设置'} <span aria-hidden="true">›</span></small></button>; })}<button onClick={() => setModal('seasonings')}><span>调料</span><small>{meal.checkSeasonings ? `${meal.seasonings.length} 种现有` : '不限库存'} <span aria-hidden="true">›</span></small></button></div>
          <label className="checkbox purchase-setting"><input type="checkbox" checked={meal.allowBuy} onChange={e => edit({ allowBuy: e.target.checked })}/><span>允许补买食材<small>{meal.composition === 'custom' ? '按指定荤素汤数量搭配，缺少的列入补买清单' : meal.allowBuy ? '列出更多菜谱，并标明需要补买什么' : '只用现有食材，直接搭配一餐'}</small></span></label>
          <div className="generate-bar"><button className="button primary full generate-button" aria-label="安排这一餐" disabled={busy || crossTab} onClick={() => void generate()}>{busy ? '正在搭配…' : meal.composition === 'custom' ? '按指定数量搭配' : meal.allowBuy ? '看看可以做什么' : '搭配这一餐'} <span>✧</span></button>{busy && <button className="text-button" onClick={() => { controller.current?.abort(); operation.current = ''; setBusy(false); setNotice('已取消，输入保留'); }}>取消</button>}</div>
        </section>
      </div>
      <section ref={resultRef} id="results" className="results-column" aria-label="本餐推荐"><div className="results-heading"><div><div className="eyebrow">MADE FOR YOUR TABLE</div><h2>这一餐，安排好了</h2></div><span className="subtle">从手边食材开始</span></div><div className="result-toolbar"><div className="recommendation-mode"><strong>{meal.composition === 'custom' ? '按需搭配' : meal.allowBuy ? '更多菜谱' : '一键搭配'}</strong><small>{meal.composition === 'custom' ? '按你指定的荤、素、汤数量搭配一餐' : meal.allowBuy ? '复用现有食材，缺少的列入补买清单 · 每页 6 道可选菜谱' : '按人数、食材种类和用量灵活搭配'}</small></div><div className="toolbar-actions"><button className="text-button" onClick={newMeal}>开始新一餐 ↻</button><button className="text-button" aria-expanded={countsOpen} aria-controls="custom-counts" onClick={() => setCountsOpen(!countsOpen)}>荤素汤搭配 ⌄</button></div></div>
        {countsOpen && <div id="custom-counts" className="count-settings"><label className="checkbox"><input type="checkbox" checked={meal.composition === 'custom'} onChange={e => { setNotice(''); edit({ composition: e.target.checked ? 'custom' : 'auto' }); }}/>明确指定荤、素、汤数量</label>{meal.composition === 'custom' ? <><div className="counts-fields">{(['meat', 'veg', 'soup'] as const).map(k => <label key={k}>{labels[k]}<input aria-label={`${labels[k]}道数`} type="number" min="0" max="20" step="1" value={Number.isNaN(meal.counts[k]) ? '' : meal.counts[k]} onChange={e => { setNotice(''); edit({ counts: { ...meal.counts, [k]: e.target.value === '' ? NaN : Number(e.target.value) } }); }}/></label>)}</div><p className="small">合计 1～20 道，不需要的类别填 0。食材不足会告知；允许补买后按指定数量搭配。</p></> : <p className="small">自动根据人数、食材种类和用量决定菜数，尽量贴近人数参考，不固定为三道或六道。填写用量，推荐会更精确。</p>}<button className="text-button" onClick={() => setModal('guide')}>查看 1～12 人配菜参考 ↗</button></div>}
        {meal.health && <div className="health-test-banner" role="note"><strong>健康模式 · 本机测试</strong><p>{result?.healthAssessment?.message ?? '当前仅验证设置与推荐流程，尚未按疾病规则筛选菜谱。'}</p><button onClick={() => edit({ health: false })}>切回普通模式</button></div>}{(result || busy) && <p className="result-conditions">{meal.servings || '待确认'} 人用餐 · {meal.includeAdditional ? '也照顾同餐人的饮食要求' : '按我的饮食要求'} · {meal.allowBuy ? '允许补买' : '不额外补买'}</p>}
        {busy && <div className="progress" role="status"><span className="spinner"/>{progress}</div>}
        {!result && !busy && <div className="results-empty empty-result"><div className="empty-plate" aria-hidden="true">🥬</div><h3>好好吃饭，从手边开始</h3><p>添加手边食材，选好口味，<br/>让我们把这一餐搭配好。</p><div className="empty-steps"><span><b>1</b>添加食材</span><span><b>2</b>搭配一餐</span><span><b>3</b>照着做就好</span></div></div>}
        {result && <><div className={`result-state ${result.status === 'completed' ? '' : 'warning-box'}`} role="status"><strong>{result.status === 'completed' ? `为你找到 ${result.dishes.length} 道${result.search === 'incomplete' ? ' · 搜索未完成' : ''}` : result.status === 'needs_confirmation' ? '还有信息需要核对' : result.status === 'no_results' ? '暂时没有合适的搭配' : '本次推荐未完成'}</strong>{result.reasons.map(r => <p key={r}>{friendly(r)}</p>)}{meal.composition === 'custom' && !meal.allowBuy && !result.targetMet && ['completed', 'no_results'].includes(result.status) && <button className="buy-to-complete" onClick={() => { const snapshot = edit({ allowBuy: true }); void generate('generate', { selected: [], previous: [] }, snapshot); }}>允许补买，按指定数量搭配</button>}{meal.health && <button onClick={() => edit({ health: false })}>主动返回普通模式</button>}</div>
          <div className="recipe-grid">{result.dishes.map((dish, index) => <article className="recipe-card" key={dish.recipe.id} data-testid="recipe-card"><div className="card-photo"><img src={`/assets/${dish.recipe.image}.png`} alt={`${dish.recipe.name}的餐食示意（非成品实拍）`} loading="lazy"/><span className="card-number">{String(index + 1).padStart(2, '0')}</span><FavoriteControl compact recipe={dish.recipe} variant={dish.variant} active={isFavorite(dish.recipe, dish.variant)} toggle={() => toggleFavorite(dish.recipe, dish.variant)}/><span className="image-caption">餐食示意</span></div><div className="card-body"><div className="card-tags"><span>{labels[dish.recipe.category]}</span><span>{dish.recipe.homeStyle ? '家常味' : '换个花样'}</span><span>{dish.recipe.minutes} 分钟</span></div><h4>{dish.recipe.name}</h4><p className="card-ingredients">{dish.variant.lines.filter(l => l.role === 'main').map(l => foodById.get(l.foodId)?.name).join(' · ')}</p><p className="small">{dish.checks.some(c => c.state === 'shortage' || c.state === 'missing') ? `需补买${dish.checks.some(c => c.state === 'unverified') ? ' · 用量请参考菜谱' : ' · 见下方清单'}` : dish.checks.some(c => c.state === 'unverified') ? '用量请参考菜谱' : '当前用量已核对'}</p><CheckList checks={dish.checks.filter(c => c.state === 'shortage' || c.state === 'missing')}/><label className="flavor-label">单菜口味<select aria-label={`${dish.recipe.name}口味`} value={dish.variant.id} onChange={e => changeVariant(dish, e.target.value)}>{dish.recipe.variants.map(v => <option key={v.id} value={v.id}>{v.flavor}{meal.overrides[dish.recipe.id] === v.id ? ' · 手动选择' : ''}</option>)}</select></label><p className="nutrition-note">热量 {dish.nutrition.kcal === null ? '暂无法计算' : `${dish.nutrition.kcal} kcal / 整道菜`}</p><div className="card-actions"><button onClick={() => { setFavoriteFeedback(''); setDetail({ recipe: dish.recipe, variant: dish.variant, checks: dish.checks, nutrition: dish.nutrition }); }}>看看做法 <span>↗</span></button>{meal.mode === 'meal' && <button aria-label={`替换 ${dish.recipe.name}`} onClick={() => void generate('replace', { replaceId: dish.recipe.id })}>换一道 ↻</button>}</div></div></article>)}</div>
          {result.checks.length > 0 && <details className="set-checks"><summary>本餐用量与补买清单</summary><CheckList checks={result.checks.filter(c => c.state !== 'unverified')}/><p className="small subtle">具体用量请参考菜谱，并按实际食材调整。</p></details>}
          {result.dishes.length > 0 && <div className="result-actions">{meal.mode === 'meal' ? <button onClick={() => void generate('reroll')}>整套重推 ↻</button> : <><button disabled={result.page === 0} onClick={() => void generate('page', { page: result.page - 1, cursor: result.cursor })}>上一页</button><span>{result.page + 1} / {Math.max(1, Math.ceil(result.total / 6))}</span><button disabled={(result.page + 1) * 6 >= result.total} onClick={() => void generate('page', { page: result.page + 1, cursor: result.cursor })}>下一页</button></>}</div>}
          {result.search === 'incomplete' && <button onClick={() => void generate()}>主动重新查找</button>}
          <p className="small subtle result-note">菜谱用量供参考，请根据实际食材和人数调整。</p>
        </>}
      </section></div>
      {notice && <div className="notice" role="status"><p>{notice}</p><button className="icon-button" aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    </main><footer><span className="footer-brand">拾味 <span>把日子，过得有滋有味。</span></span><span>好好吃饭，好好生活。</span></footer>
    {workspaceVisible && <div className="mobile-cta"><button className="primary" disabled={busy || crossTab} onClick={() => void generate()}>{busy ? '正在搭配…' : meal.allowBuy ? '看看可以做什么' : '搭配这一餐'} <span>{meal.ingredients.length} 种食材 · {Number.isFinite(meal.servings) ? meal.servings : '—'} 人用餐</span></button></div>}
    {modal === 'account' && <Modal title="个人设置" close={() => setModal(null)}><h3>常用偏好</h3><p>保存这餐的人数、口味、过敏、忌口和调料设置。下次点击「开始新一餐」时会自动使用。</p><button className="primary" onClick={saveDefault}>保存为常用偏好</button><p className="small">仅保存在当前浏览器中。</p>{notice && <p role="status" className="modal-feedback">{notice}</p>}<h3>账户与同步</h3>{sessionInfo?.identity === 'local-test' ? <><p className="account-state">✓ 已登录 · 本机测试账号</p><p className="small subtle">当前浏览器中保留登录状态；跨设备同步尚未接入。</p><button disabled={authBusy} onClick={() => void signOut()}>{authBusy ? '正在退出…' : '退出登录'}</button></> : <><p>{sessionInfo?.localTestFeatures ? '登录测试账号，体验健康模式。食材、偏好和收藏继续保留。' : '账户登录和跨设备同步暂不可用。'}</p>{sessionInfo?.localTestFeatures && <button className="primary" onClick={() => { setLoginReturn('account'); setAuthMessage(''); setModal('login'); }}>登录</button>}</>}{authMessage && <p role="status">{authMessage}</p>}</Modal>}
    {(modal === 'allergy' || modal === 'avoid') && <Modal title={modal === 'allergy' ? '过敏设置' : '忌口设置'} close={() => setModal(null)}>
      <p>{modal === 'allergy' ? '添加会引起过敏的食物，确认后会避开相关菜谱。' : '添加不想吃或不能吃的食物，确认后会避开相关菜谱。'}</p>
      <form className="restriction-add" onSubmit={e => { e.preventDefault(); addRestriction(); }}><label>为谁设置<select aria-label="为谁设置" value={restrictionScope} onChange={e => setRestrictionScope(e.target.value as 'self' | 'additional')}><option value="self">我自己</option><option value="additional">一起吃饭的人</option></select></label><label>{modal === 'allergy' ? '过敏食物' : '忌口食物'}<input aria-label={modal === 'allergy' ? '过敏食物' : '忌口食物'} maxLength={200} value={restrictionText} onChange={e => setRestrictionText(e.target.value)} placeholder="输入食物名称"/></label><button className="primary" disabled={!restrictionText.trim()}>确认添加</button></form>
      {notice && <p role="status" className="modal-feedback">{notice}</p>}<ul className="restrictions">{meal.restrictions.filter(r => r.kind === modal || (modal === 'avoid' && r.kind === 'unclassified')).map(r => <li key={r.id}><div><strong>{r.name.replace(/^未分类：/, '')}</strong> <span className="small">{r.scope === 'self' ? '我自己' : '一起吃饭的人'}</span></div><p>{r.status === 'confirmed' ? '会避开：' : r.targets.length ? '请确认要避开的食物：' : '还没认出这个食物，请删除后换个名称。'}{r.targets.map(t => foodById.get(t)?.name).join('、')}</p>{r.targets.length > 1 && <p className="small subtle">目前可识别以上食物，如有其他需要避开的食物，请单独添加。</p>}<div className="actions">{r.targets.length > 0 && r.status === 'pending' && <button onClick={() => edit(m => ({ ...m, restrictions: m.restrictions.map(x => x.id === r.id ? { ...x, status: 'confirmed' } : x) }))}>确认避开这些食物</button>}{r.kind === 'unclassified' && r.status !== 'conflict' && <button onClick={() => { const name = r.name.replace(/^未分类：/, ''); if (meal.ingredients.length >= 100) { setNotice('食材已达 100 种，请先移除不需要的食材'); return; } edit(m => ({ ...m, restrictions: m.restrictions.filter(x => x.id !== r.id), ingredients: mergeInput(m.ingredients, [inputIngredient(name)]) })); }}>这是食材，加入清单</button>}<button onClick={() => deleteRestriction(r.id)}>移除</button></div></li>)}</ul>
      <label className="checkbox"><input type="checkbox" checked={meal.includeAdditional} onChange={e => edit({ includeAdditional: e.target.checked })}/>这顿饭也照顾同行人的过敏和忌口</label><p className="small subtle">默认只使用你的饮食要求。勾选后，一起吃饭的人的过敏和忌口也会用于本餐。</p><button onClick={() => setModal(null)}>完成</button>
    </Modal>}
    {modal === 'guide' && <Modal title="人数与配菜参考" close={() => setModal(null)}><p>人数只用于参考菜数，每道菜的做法和用量保持不变。实际菜数会随食材种类、填写用量和饮食要求调整，不要求凑齐。</p><table className="serving-table"><caption>1～12 人配菜参考</caption><thead><tr><th scope="col">人数</th><th scope="col">荤菜</th><th scope="col">素菜</th><th scope="col">汤品</th><th scope="col">合计</th></tr></thead><tbody>{servingReferences.map(r => <tr key={r.servings} aria-current={r.servings === meal.servings ? 'true' : undefined}><th scope="row">{r.servings} 人</th><td>{r.counts.meat}</td><td>{r.counts.veg}</td><td>{r.counts.soup || '—'}</td><td>{r.total} 道</td></tr>)}</tbody></table><p className="small subtle">这是做饭搭配参考，不是食量或营养标准。需要招待或多做几道时，可指定荤素汤数量，最多 20 道。</p><button onClick={() => setModal(null)}>知道了</button></Modal>}
    {modal === 'seasonings' && <Modal title="调料设置" close={() => setModal(null)}><label className="checkbox"><input type="checkbox" checked={meal.checkSeasonings} onChange={e => edit({ checkSeasonings: e.target.checked })}/>只使用家里现有的调料</label><p className="small">开启后，请勾选家里有的调料；关闭时不核对调料库存。过敏和忌口始终生效。</p>{meal.checkSeasonings && <div className="seasonings">{seasoningIds.map(id => <label className="checkbox" key={id}><input type="checkbox" checked={meal.seasonings.includes(id)} onChange={e => edit({ seasonings: e.target.checked ? [...meal.seasonings, id] : meal.seasonings.filter(s => s !== id) })}/>{foodById.get(id)?.name}</label>)}</div>}<button onClick={() => setModal(null)}>完成</button></Modal>}
    {modal === 'favorites' && <Modal title="我的收藏" close={() => setModal(null)}><p className="small">收藏保存菜谱与口味，做法和用量保持不变。再次打开会核对当前食材及饮食要求。</p>{!favorites.length && <p className="empty-modal">看到喜欢的菜，点一下心形收藏。</p>}{favorites.map(f => { const r = recipes.find(r => r.id === f.recipeId), v = r?.variants.find(v => v.id === f.variantId); return <div className="favorite-row" key={favoriteKey(f)}><button onClick={() => void openFavorite(f)}>{r?.name ?? '内容已失效'} · {v?.flavor ?? '待核对'} ↗</button><button onClick={() => { const next = favorites.filter(x => favoriteKey(x) !== favoriteKey(f)); setFavorites(next); writeValue('shiwei:guest:favorites:v1', next); }}>移除</button></div>; })}</Modal>}
    {modal === 'login' && <Modal title="登录" close={() => { if (!authBusy) setModal(loginReturn); }}><div className="login-symbol" aria-hidden="true">拾</div><h3>本机测试账号</h3><p>用于体验登录和健康模式。无需填写真实个人资料，不连接正式账户服务。</p>{sessionInfo?.localTestFeatures ? <button className="primary login-submit" disabled={authBusy} onClick={() => void login()}>{authBusy ? '正在登录…' : '登录测试账号'}</button> : <p>当前服务未开启本机测试登录。</p>}{authMessage && <p role="alert">{authMessage}</p>}</Modal>}
    {modal === 'health' && <Modal title="健康模式" close={() => setModal(null)}>{sessionInfo?.localTestFeatures ? <><p className="health-test-note">本机测试：可体验设置与推荐流程，当前菜谱尚未按疾病规则筛选。</p><label htmlFor="disease-text">需要关注的疾病名称</label><input id="disease-text" maxLength={100} value={diseaseText} onChange={e => setDiseaseText(e.target.value)} placeholder="输入名称后添加"/><div className="chips">{['高血压', '糖尿病', '痛风'].map(d => <button key={d} aria-pressed={meal.diseases.includes(d)} onClick={() => edit({ diseases: meal.diseases.includes(d) ? meal.diseases.filter(x => x !== d) : [...meal.diseases, d] })}>{d}</button>)}</div><button disabled={!diseaseText.trim()} onClick={() => { const name = diseaseAliases[diseaseText.trim()] ?? diseaseText.trim(); if (meal.diseases.length < 20) { edit({ diseases: [...new Set([...meal.diseases, name])] }); setDiseaseText(''); } else setAuthMessage('最多添加 20 个名称，请先移除不需要的名称'); }}>添加名称</button><div className="health-names">{meal.diseases.map(d => <button key={d} aria-label={`移除疾病 ${d}`} onClick={() => edit({ diseases: meal.diseases.filter(x => x !== d) })}>{d} ×</button>)}</div><p className="small subtle">名称只用于测试设置，不表示该疾病已获支持。</p><button className="primary" onClick={enableHealth}>{sessionInfo.identity === 'local-test' ? '开启健康模式测试' : '登录并开启健康模式测试'}</button>{meal.health && <button onClick={() => { edit({ health: false }); setModal(null); }}>关闭健康模式</button>}{authMessage && <p role="status">{authMessage}</p>}</> : <><p>健康推荐暂不可用。你仍可使用普通推荐，并分别设置过敏和忌口。</p><button className="primary" onClick={() => { edit({ health: false }); setModal(null); }}>使用普通模式</button></>}</Modal>}
    {detail && <Modal title={detail.recipe.name} close={() => setDetail(null)}><p className="detail-meta">{detail.variant.flavor} · {detail.recipe.minutes} 分钟</p>{detail.message && <p role="status" className="warning-box">{detail.message}</p>}<img className="detail-photo" src={`/assets/${detail.recipe.image}.png`} alt="餐食示意，非成品实拍"/><h3>菜谱参考用量</h3><ul className="detail-lines">{detail.variant.lines.map((l, i) => <li key={`${l.foodId}-${i}`}><span>{foodById.get(l.foodId)?.name}{l.optional ? '（可省）' : ''}</span><span>{l.amount}{l.unit} · 可食净量</span></li>)}</ul>{detail.checks && <CheckList checks={detail.checks}/>}<h3>慢慢来，一步步做</h3><ol className="steps">{detail.variant.steps.map(s => <li key={s}>{s}</li>)}</ol><div className="nutrition-box"><h3>营养参考</h3><p>热量：{detail.nutrition?.kcal ?? '暂无法计算'}<br/>蛋白质：{detail.nutrition?.protein ?? '暂无法计算'}<br/>钠：{detail.nutrition?.sodium ?? '暂无法计算'}</p><p className="small">标准配方整道菜的投料估算，仅供参考；缺少数据的营养项暂不显示数值。</p></div><div className="detail-favorite-area"><FavoriteControl recipe={detail.recipe} variant={detail.variant} active={isFavorite(detail.recipe, detail.variant)} toggle={() => toggleFavorite(detail.recipe, detail.variant)}/><p className="favorite-feedback" role="status" aria-live="polite">{favoriteFeedback}</p></div></Modal>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);

