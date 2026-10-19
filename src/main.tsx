import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { categories, diseaseAliases, findFood, foodById, foods, recipes } from '../shared/catalog';
import { extractText, makeRestriction, mergeIngredients } from '../shared/extraction';
import { parseQuantity } from '../shared/quantity';
import { defaultMeal, type Dish, type Extraction, type Favorite, type Ingredient, type Meal, type QuantityCheck, type Recipe, type RecommendationRequest, type RecommendationResult, type Variant } from '../shared/types';
import { establishSession, extract, requestRecommendation } from './api';
import { readFavorites, readMeal, STORAGE_KEY, writeMeal, writeValue } from './storage';
import './demo.css';
import './styles.css';

const labels = { meat: '荤菜', veg: '素菜', soup: '汤品' };
const fresh = () => crypto.randomUUID();
const favoriteKey = (f: Favorite) => `${f.recipeId}:${f.variantId}`;
const example = '鸡肉300g香菇200g西红柿500g鸡蛋4个土豆500g菠菜300g西兰花300g黄瓜300g';
function Modal({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current!; el.showModal(); return () => { el.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="modal-top modal-header"><h2 id="modal-title">{title}</h2><button onClick={close} aria-label="关闭弹层" className="icon-button">×</button></div><div className="modal-content">{children}</div>
  </dialog>;
}
function CheckList({ checks }: { checks: QuantityCheck[] }) {
  return <ul className="checks">{checks.map(c => <li key={c.foodId} className={c.state === 'enough' ? '' : 'warning'}>
    <strong>{c.name}</strong> · {c.state === 'enough' ? `已有 ${c.available}${c.unit}，需要 ${c.needed}${c.unit}` : c.state === 'shortage' ? `还需 ${c.shortage}${c.unit}（已有 ${c.available}，需要 ${c.needed}）` : c.state === 'missing' ? c.unit === '有无' ? '缺少必需调味料' : `需补买 ${c.needed}${c.unit}` : c.reason}
    {c.unit !== '有无' && <span className="small"> · {c.basis === 'edible' ? '可食净量' : '计量基准待核对'}</span>}
  </li>)}</ul>;
}
function App() {
  const [meal, setMeal] = useState<Meal>(() => readMeal());
  const mealRef = useRef(meal); mealRef.current = meal;
  const [favorites, setFavorites] = useState<Favorite[]>(readFavorites);
  const [demo, setDemo] = useState(false); const real = useRef<Meal | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState(''); const [storageError, setStorageError] = useState(false);
  const [crossTab, setCrossTab] = useState(false);
  const [tab, setTab] = useState<'text' | 'image'>('image');
  const [countsOpen, setCountsOpen] = useState(false);
  const [modal, setModal] = useState<'favorites' | 'health' | 'account' | 'clear' | null>(null);
  const [detail, setDetail] = useState<{ recipe: Recipe; variant: Variant; checks?: QuantityCheck[]; nutrition?: Dish['nutrition']; message?: string } | null>(null);
  const [diseaseText, setDiseaseText] = useState('');
  const [restrictionText, setRestrictionText] = useState('');
  const [restrictionKind, setRestrictionKind] = useState<'allergy' | 'avoid'>('allergy');
  const [restrictionScope, setRestrictionScope] = useState<'self' | 'additional'>('self');
  const [manualName, setManualName] = useState('');
  const controller = useRef<AbortController | null>(null); const operation = useRef('');
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => { void establishSession().catch(e => setNotice(e.message)); return () => controller.current?.abort(); }, []);
  useEffect(() => { if (!demo && !crossTab) setStorageError(!writeMeal(meal)); }, [meal, demo, crossTab]);
  useEffect(() => {
    const handle = (event: StorageEvent) => { if (event.key === STORAGE_KEY && !demo) { controller.current?.abort(); operation.current = ''; setBusy(false); setResult(null); setCrossTab(true); } };
    window.addEventListener('storage', handle); return () => window.removeEventListener('storage', handle);
  }, [demo]);
  const edit = (change: Partial<Meal> | ((m: Meal) => Meal)) => {
    controller.current?.abort(); operation.current = ''; setBusy(false); setResult(null);
    const previous = mealRef.current;
    const updated = typeof change === 'function' ? change(previous) : { ...previous, ...change };
    const next = { ...updated, version: previous.version + 1 };
    mealRef.current = next; setMeal(next); return next;
  };
  const ingredient = (id: string, fields: Partial<Ingredient>) => edit(m => ({ ...m, ingredients: m.ingredients.map(i => i.id === id ? { ...i, ...fields } : i) }));
  const active = meal.restrictions.filter(r => r.scope === 'self' || meal.includeAdditional);
  const pending = active.filter(r => r.status !== 'confirmed');
  const addParsed = (data: Extraction) => {
    edit(m => ({ ...m, ingredients: mergeIngredients(m.ingredients, data.ingredients),
      restrictions: [...m.restrictions, ...data.restrictions.filter(n => !m.restrictions.some(r => r.kind === n.kind && r.name === n.name && r.scope === n.scope)), ...data.unresolved.map(s => makeRestriction(`未分类：${s}`, 'unclassified'))],
      diseases: [...new Set([...m.diseases, ...data.diseases])], servings: data.servings ?? m.servings }));
    setExtraction(null); setNotice('已追加待核对信息。食材和限制确认后才会生效；疾病名称不代表已支持。');
  };
  const organize = async () => {
    if (!meal.raw.trim()) { setNotice('先写下手边的食材吧'); return; }
    const snapshot = mealRef.current.version;
    try { const data = await extract(meal.raw); if (snapshot === mealRef.current.version) setExtraction(data); }
    catch (e) { setNotice((e as Error).message); }
  };
  const generate = async (action: RecommendationRequest['action'] = 'generate', extra: Partial<RecommendationRequest> = {}, snapshot = mealRef.current) => {
    if (crossTab) { setNotice('另一页面修改了草稿，请先选择恢复版本'); return; }
    if (!Number.isInteger(snapshot.servings) || snapshot.servings < 1 || snapshot.servings > 12) { setNotice('人数须为 1～12 的整数'); document.getElementById('servings')?.focus(); return; }
    controller.current?.abort(); const aborter = new AbortController(); controller.current = aborter;
    const operationId = fresh(); operation.current = operationId;
    setBusy(true); setNotice(''); setProgress('正在提交本餐条件');
    const body: RecommendationRequest = { operationId, meal: snapshot, action, page: 0, previous: result?.dishes.map(d => d.recipe.id) ?? [], selected: result?.dishes.map(d => ({ recipeId: d.recipe.id, variantId: d.variant.id })) ?? [], ...extra };
    try {
      const next = await requestRecommendation(body, aborter.signal, setProgress);
      if (operation.current !== operationId || mealRef.current.version !== snapshot.version) return;
      if (!next.changed && result) setNotice(next.reasons.join('；'));
      else { setResult(next); resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } catch (e) { if (!aborter.signal.aborted && operation.current === operationId) setNotice((e as Error).message); }
    finally { if (operation.current === operationId) setBusy(false); }
  };
  const enterDemo = (scenario: 'normal' | 'recognition' | 'shortage' | 'allergy' | 'unsupported' | 'combination' = 'normal') => {
    if (!demo) real.current = structuredClone(mealRef.current);
    setDemo(true); setCrossTab(false);
    const data = extractText(example); const m = defaultMeal();
    m.ingredients = data.ingredients.map(i => ({ ...i, status: 'confirmed', basis: 'edible' }));
    if (scenario === 'recognition') m.ingredients = [...m.ingredients.slice(0, 2), { id: fresh(), foodId: null, name: '疑似食材', amount: '', status: 'pending', basis: 'unknown', form: 'raw', original: '开发构造疑似项' }];
    if (scenario === 'shortage') { m.ingredients = extractText('鸡肉1g香菇1g').ingredients.map(i => ({ ...i, status: 'confirmed', basis: 'edible' })); m.servings = 12; }
    if (scenario === 'allergy') m.restrictions = [{ ...makeRestriction('鸡蛋', 'allergy'), status: 'confirmed' }];
    if (scenario === 'unsupported' || scenario === 'combination') { m.health = true; m.diseases = scenario === 'unsupported' ? ['偏头痛'] : ['高血压', '糖尿病']; }
    edit({ ...m, version: meal.version + 1 }); setNotice('已进入独立演示；退出或刷新会恢复原本餐。');
  };
  const exitDemo = () => { edit(real.current ?? readMeal()); setDemo(false); real.current = null; setNotice('已恢复进入演示前的草稿'); };
  const saveDefault = () => {
    if (demo) { setNotice('演示状态不能保存为个人默认'); return; }
    if (pending.length) { setNotice('先核对待处理限制，再保存默认'); return; }
    const defaults = { ...meal, ingredients: [], raw: '', overrides: {}, includeAdditional: false, version: 0 };
    setNotice(writeValue('shiwei:guest:defaults:v1', defaults) ? '已主动保存到本机默认；本餐草稿仍独立保留' : '浏览器未允许保存，本次修改仍在当前页面');
  };
  const newMeal = () => { const defaults = readMeal('shiwei:guest:defaults:v1'); edit(defaults); setDemo(false); real.current = null; setExtraction(null); setNotice('已开始新一餐，加载本机默认；收藏保留'); };
  const toggleFavorite = (recipe: Recipe, variant: Variant) => {
    if (demo) { setNotice('演示收藏不会写入个人收藏；请退出演示后使用'); return; }
    const f = { recipeId: recipe.id, variantId: variant.id }, key = favoriteKey(f);
    const next = favorites.some(v => favoriteKey(v) === key) ? favorites.filter(v => favoriteKey(v) !== key) : [...favorites, f];
    setFavorites(next); if (!writeValue('shiwei:guest:favorites:v1', next)) setStorageError(true);
  };
  const openFavorite = async (f: Favorite) => {
    const recipe = recipes.find(r => r.id === f.recipeId), variant = recipe?.variants.find(v => v.id === f.variantId);
    if (!recipe || !variant) { setNotice('收藏内容已变化或停用，请重新选择'); return; }
    setModal(null);
    setDetail({ recipe, variant, message: '正在按本餐人数与限制重新核对…' });
    const snapshot = mealRef.current.version;
    try {
      const m = { ...mealRef.current, mode: 'meal' as const, overrides: { ...meal.overrides, [recipe.id]: variant.id } };
      const checked = await requestRecommendation({ operationId: fresh(), meal: m, action: 'variant', selected: [f], page: 0, previous: [] }, new AbortController().signal, () => {});
      if (snapshot !== mealRef.current.version) return;
      const dish = checked.dishes.find(d => d.recipe.id === recipe.id);
      setDetail({ recipe, variant, checks: dish?.checks, nutrition: dish?.nutrition, message: dish ? '已按当前人数与限制复查；仍须留意数量未核实项' : checked.reasons.join('；') });
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
      <div className="header-actions"><span className="demo-badge">开发预览</span><button className="avatar" aria-label="本机资料与账户" onClick={() => setModal('account')}>我</button></div></header>
    <main>
      <section className="page-intro"><div><div className="eyebrow">A LITTLE INSPIRATION, EVERY DAY</div><h1>今天，吃点什么？<span className="sun-icon" aria-hidden="true">✳</span></h1><p>打开冰箱，把手边的食材变成一顿好饭。</p></div><button className="health-entry" onClick={() => setModal('health')}><span className="health-symbol" aria-hidden="true">♡</span><span><strong>健康模式</strong><small>{meal.health ? '当前健康能力尚未开放' : '按需开启，照顾你的饮食限制'}</small></span><span className={`switch ${meal.health ? 'on' : ''}`} aria-hidden="true"/></button></section>
      <section className="hero-banner"><div className="hero-copy"><span className="hero-tag"><i/> 少一点纠结，多一点烟火气</span><h2>有啥，做啥。<br/>好好吃一餐。</h2><p>食材不浪费，搭配刚刚好。</p></div><div className="hero-photo" role="img" aria-label="番茄炒蛋、时蔬和汤的家常餐食示意"><div className="photo-note">家常滋味 · 图片为示意</div></div><span className="hero-doodle" aria-hidden="true">✳</span></section>
      {demo && <div className="demo-banner" role="status"><div><strong>正在体验独立演示</strong><p>演示修改不会写入个人草稿和默认，刷新自动退出。</p></div><button onClick={exitDemo}>退出并恢复本餐 ↗</button></div>}
      {crossTab && <div className="warning-box" role="alert">另一页面更新了本机草稿。当前页面已暂停推荐，避免静默覆盖。<div className="actions"><button onClick={() => { const restored = readMeal(); setCrossTab(false); edit(restored); }}>载入另一页面版本</button><button onClick={() => { setCrossTab(false); edit({}); }}>保留当前编辑并写回</button></div></div>}
      {storageError && <p role="alert" className="warning-box">浏览器未允许本机保存。当前页面可继续，刷新可能无法恢复。</p>}
      <div id="workspace" className="workspace"><div className="input-column"><section className="panel ingredient-panel"><div className="section-heading"><h2><span className="step-number">01</span>看看有什么食材</h2><span className="subtle">{meal.ingredients.length} 种</span></div>
          <div className="input-tabs" role="group" aria-label="输入方式"><button className={tab === 'image' ? 'selected' : ''} aria-pressed={tab === 'image'} onClick={() => setTab('image')}>拍照 / 上传</button><button className={tab === 'text' ? 'selected' : ''} aria-pressed={tab === 'text'} onClick={() => setTab('text')}>文字输入</button></div>
          {tab === 'text' ? <><label className="sr-only" htmlFor="raw">输入食材与本餐信息</label><textarea id="raw" maxLength={5000} value={meal.raw} onChange={e => edit({ raw: e.target.value })} placeholder="例如：西红柿2个鸡蛋3个菠菜一把，2个人吃，对虾过敏"/><button className="button outline full organize-button" onClick={() => void organize()}>整理信息 ↗</button><p className="small subtle input-note">本地词典辅助整理，未接入模型。无法理解的片段会保留供归类。</p></> : <div className="upload-zone"><span className="upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="16" cy="9" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/></svg></span><strong>拍下食材，灵感就来了</strong><span>图片识别准备中 · 暂不上传图片</span><span className="upload-buttons"><button className="mini-button" disabled>选择图片</button><button className="camera-button" disabled>手机拍照</button></span><button className="text-button" onClick={() => setTab('text')}>转到文字录入 →</button></div>}
          <button className="example-button" aria-label="用示例试试 ↗" onClick={() => enterDemo()}><span>✧</span>没想好？用示例食材试一试<span>→</span></button>
          {extraction && <div className="extraction" aria-label="待追加的信息"><h4>核对整理结果</h4><p className="small">原文：{extraction.original}</p><p>{extraction.ingredients.map(i => `${i.name} ${i.amount || '用量选填'}`).join('、') || '未识别到目录内食材'}</p>{extraction.restrictions.map(r => <p key={r.id} className="warning">{r.kind === 'allergy' ? '过敏' : r.kind === 'avoid' ? '忌口' : '待归类'}：{r.name}</p>)}{extraction.servings !== null && <p>人数候选：{extraction.servings} 人</p>}{extraction.diseases.length > 0 && <p>疾病名称候选：{extraction.diseases.join('、')} · 尚未开放健康支持</p>}{extraction.unresolved.length > 0 && <p className="warning">未解析：{extraction.unresolved.join('、')}（追加后须归类）</p>}<div className="actions"><button className="primary" onClick={() => addParsed(extraction)}>追加到清单，逐项核对</button><button onClick={() => setExtraction(null)}>暂不追加</button></div></div>}
          <div className="ingredient-heading list-label"><strong>我的食材</strong>{meal.ingredients.some(i => i.status === 'pending' && i.foodId) ? <button className="text-button" onClick={() => edit(m => ({ ...m, ingredients: m.ingredients.map(i => i.foodId && i.status === 'pending' ? { ...i, status: 'confirmed' } : i) }))}>确认已知食材</button> : <span>用量选填，可直接修改</span>}</div>
          {!meal.ingredients.length && <div className="ingredient-empty">还没有食材，拍张照或手动添加吧</div>}
          <ul className="ingredients">{meal.ingredients.map(i => <li key={i.id}><div className="ingredient-row"><label><span className="sr-only">食材名称</span><input aria-label={`食材名称 ${i.name}`} list="food-names" value={i.name} onChange={e => { const f = findFood(e.target.value); ingredient(i.id, { name: e.target.value, foodId: f?.id ?? null, status: 'pending' }); }}/></label><label><span className="sr-only">{i.name}用量</span><input aria-label={`${i.name}用量`} value={i.amount} placeholder={`选填，如 200${foodById.get(i.foodId ?? '')?.unit ?? 'g'}`} onChange={e => ingredient(i.id, { amount: e.target.value, status: 'pending' })}/></label><button className="icon-button" aria-label={`删除食材 ${i.name}`} onClick={() => edit(m => ({ ...m, ingredients: m.ingredients.filter(x => x.id !== i.id) }))}>×</button></div>
            <div className="ingredient-options"><select aria-label={`${i.name}计量基准`} value={i.basis} onChange={e => ingredient(i.id, { basis: e.target.value as Ingredient['basis'] })}><option value="unknown">基准未确认</option><option value="edible">已确认可食净量</option><option value="as_purchased">购买毛重</option></select><select aria-label={`${i.name}形态`} value={i.form} onChange={e => ingredient(i.id, { form: e.target.value })}><option value="raw">生原料 / 去骨去皮</option><option value="bone_in">带骨</option><option value="skin_on">带皮</option><option value="cooked">熟制</option></select><button className={i.status === 'confirmed' ? 'confirmed text-button' : 'text-button'} disabled={!i.foodId} onClick={() => ingredient(i.id, { status: 'confirmed', alternative: undefined })}>{i.status === 'confirmed' ? '✓ 已确认' : i.status === 'conflict' ? '保留当前值并确认' : '确认'}</button></div>
            {i.alternative && <p className="small warning">追加值：{i.alternative}。未相加或覆盖；请修改当前值后确认。</p>}<p className={`small ${i.status === 'confirmed' ? 'subtle' : 'warning'}`}>{!i.foodId ? '疑似食材，未匹配目录，不参与推荐' : i.status !== 'confirmed' ? '待核对，暂不参与推荐' : !parseQuantity(i.amount) ? '数量未核实 · 可补单位、保留约量或空白' : i.basis !== 'edible' || i.form !== 'raw' ? '计量基准或形态未匹配，数量未核实' : parseQuantity(i.amount)?.unit !== foodById.get(i.foodId)?.unit ? '单位无法比较，数量未核实' : '可在相同计量基准下参与库存核对'}</p></li>)}</ul>
          <div className="manual-add"><input aria-label="手动添加食材名称" list="food-names" value={manualName} maxLength={100} onChange={e => setManualName(e.target.value)} placeholder="手动添加食材…"/><button disabled={!manualName.trim()} onClick={() => { const f = findFood(manualName.trim()); edit(m => ({ ...m, ingredients: mergeIngredients(m.ingredients, [{ id: fresh(), foodId: f?.id ?? null, name: f?.name ?? manualName.trim(), amount: '', status: 'pending', basis: 'unknown', form: 'raw', original: manualName }]) })); setManualName(''); }}>＋ 添加</button></div><datalist id="food-names">{foods.map(f => <option key={f.id} value={f.name}/>)}</datalist>
        </section>
        <section className="panel preferences"><div className="section-heading"><h2><span className="step-number">02</span>这一餐的偏好</h2><button className="text-button" onClick={() => { const settings = document.getElementById('restriction-settings') as HTMLDetailsElement; settings.open = true; settings.scrollIntoView({ behavior: 'smooth', block: 'center' }); settings.querySelector('summary')?.focus(); }}>个人设置 ↗</button></div>
          <div className="setting-row"><label htmlFor="servings">几个人吃<small>人数只调整份量</small></label><div className="stepper"><button aria-label="减少人数" onClick={() => edit({ servings: Math.max(1, (meal.servings || 1) - 1) })}>−</button><input id="servings" type="number" min="1" max="12" step="1" value={Number.isNaN(meal.servings) ? '' : meal.servings} onChange={e => edit({ servings: e.target.value === '' ? NaN : Number(e.target.value) })}/><button aria-label="增加人数" onClick={() => edit({ servings: Math.min(12, (meal.servings || 1) + 1) })}>＋</button></div></div>
          {(!Number.isInteger(meal.servings) || meal.servings < 1 || meal.servings > 12) && <p role="alert" className="warning">人数须为 1～12 的整数</p>}
          <fieldset className="flavor-setting"><legend>今天的口味</legend><div className="chips flavor-options">{['不限', '清淡', '微辣'].map(f => <button className={`flavor-button ${meal.flavor === f ? 'active' : ''}`} key={f} aria-pressed={meal.flavor === f} onClick={() => edit({ flavor: f })}>{f}</button>)}</div><p className="small subtle">已手动选择的单菜口味会保留。</p></fieldset>
          <details id="restriction-settings"><summary>过敏与明确忌口 <span>{active.filter(r => r.status === 'confirmed').length} 项已确认{pending.length ? ` · ${pending.length} 项待处理` : ''}</span></summary><p className="small">仅应用本人限制；主动合并后才加入附加清单。类别确认范围限于当前测试目录。</p><div className="restriction-add"><select aria-label="限制类型" value={restrictionKind} onChange={e => setRestrictionKind(e.target.value as 'allergy' | 'avoid')}><option value="allergy">过敏</option><option value="avoid">明确忌口</option></select><select aria-label="限制所属" value={restrictionScope} onChange={e => setRestrictionScope(e.target.value as 'self' | 'additional')}><option value="self">本人</option><option value="additional">附加清单</option></select><input aria-label="添加限制名称" value={restrictionText} onChange={e => setRestrictionText(e.target.value)} placeholder="如：虾、海产品"/><button disabled={!restrictionText.trim()} onClick={() => { const r = makeRestriction(restrictionText.trim(), restrictionKind, restrictionScope); edit(m => ({ ...m, restrictions: [...m.restrictions, r] })); setRestrictionText(''); }}>添加</button></div>
          <ul className="restrictions">{meal.restrictions.map(r => <li key={r.id}><div><strong>{r.name}</strong> <span className="small">{r.scope === 'self' ? '本人' : '附加'} · {r.kind === 'allergy' ? '过敏' : r.kind === 'avoid' ? '忌口' : '待归类'}</span></div><p className="small">{r.status === 'confirmed' ? '✓ 已确认范围：' : r.targets.length ? '请核对排除范围：' : r.status === 'conflict' ? '此表达涉及允许或否定；原限制保留，请逐项处理。' : '范围尚不明确，应用该清单时暂停推荐。'}{r.targets.map(t => foodById.get(t)?.name).join('、')}{categories.find(c => c.name === r.name || c.aliases.includes(r.name)) && '（仅本目录覆盖，不代表全部同类食物）'}</p><div className="actions">{r.targets.length > 0 && r.status === 'pending' && <button onClick={() => edit(m => ({ ...m, restrictions: m.restrictions.map(x => x.id === r.id ? { ...x, status: 'confirmed' } : x) }))}>确认此范围</button>}{r.kind === 'unclassified' && <button onClick={() => { const text = r.name.replace(/^未分类：/, ''); const f = findFood(text); edit(m => ({ ...m, restrictions: m.restrictions.filter(x => x.id !== r.id), ingredients: mergeIngredients(m.ingredients, [{ id: fresh(), foodId: f?.id ?? null, name: text, amount: '', basis: 'unknown', form: 'raw', status: 'pending', original: r.original }]) })); }}>归为疑似食材</button>}<button onClick={() => deleteRestriction(r.id)}>主动移除此项</button></div></li>)}</ul><label className="checkbox"><input type="checkbox" checked={meal.includeAdditional} onChange={e => edit({ includeAdditional: e.target.checked })}/>本餐主动合并附加限制清单</label></details>
          <details><summary>调味料与补买 <span>{meal.checkSeasonings ? '检查有无' : '默认不查库存'}</span></summary><label className="checkbox"><input type="checkbox" checked={meal.checkSeasonings} onChange={e => edit({ checkSeasonings: e.target.checked })}/>检查调味料库存（仅核对有无）</label>{meal.checkSeasonings && <div className="seasonings">{['oil', 'salt', 'soy', 'garlic', 'chilli', 'vinegar', 'sugar'].map(id => <label className="checkbox" key={id}><input type="checkbox" checked={meal.seasonings.includes(id)} onChange={e => edit({ seasonings: e.target.checked ? [...meal.seasonings, id] : meal.seasonings.filter(s => s !== id) })}/>{foodById.get(id)?.name}</label>)}</div>}<p className="small subtle">不检查库存时，过敏与忌口仍会检查调味料成分。</p><label className="checkbox"><input type="checkbox" checked={meal.allowBuy} onChange={e => edit({ allowBuy: e.target.checked })}/>我接受为本餐补买缺少的食材或数量</label></details>
          <details><summary>套餐组合与健康 <span>{meal.health ? '健康未开放' : '普通模式'}</span></summary><p className="small subtle">默认目标一荤两素，按食材与库存调整。</p><button onClick={() => { setCountsOpen(true); resultRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>调整荤素汤搭配 →</button><button onClick={() => setModal('health')}>疾病名称与健康模式 →</button></details>
          <button className="text-button save-default" onClick={saveDefault}>保存本餐设置为本机默认 ↗</button>
        <div className="generate-bar"><div className="small subtle"><strong>{Number.isFinite(meal.servings) ? meal.servings : '待确认'} 人份</strong><span> · {meal.includeAdditional ? '已合并附加限制' : '仅本人限制'}</span></div><button className="button primary full generate-button" aria-label="安排这一餐" disabled={busy || crossTab} onClick={() => void generate()}>{busy ? '正在核对…' : '确认食材，搭配这一餐'} <span>✧</span></button>{busy && <button className="text-button" onClick={() => { controller.current?.abort(); operation.current = ''; setBusy(false); setNotice('已取消，输入保留'); }}>取消</button>}<p className="privacy-note">开发构造推荐 · 不检查食材新鲜度或实际健康适宜性</p></div></section>
      </div>
      <section ref={resultRef} id="results" className="results-column" aria-label="本餐推荐"><div className="results-heading"><div><div className="eyebrow">MADE FOR YOUR TABLE</div><h2>这一餐，安排好了</h2></div><span className="subtle">从手边食材开始</span></div><div className="result-toolbar"><div className="segmented" role="group" aria-label="推荐方式"><button className={meal.mode === 'meal' ? 'active' : ''} aria-label="一餐套餐" aria-pressed={meal.mode === 'meal'} onClick={() => edit({ mode: 'meal' })}>✧ 一键搭配</button><button className={meal.mode === 'candidates' ? 'active' : ''} aria-pressed={meal.mode === 'candidates'} onClick={() => edit({ mode: 'candidates' })}>多菜候选</button></div><div className="toolbar-actions"><button className="text-button" onClick={newMeal}>开始新一餐 ↻</button><button className="text-button" aria-expanded={countsOpen} aria-controls="custom-counts" onClick={() => setCountsOpen(!countsOpen)}>荤素汤搭配 ⌄</button></div></div>
        {countsOpen && <div id="custom-counts" className="count-settings"><label className="checkbox"><input type="checkbox" checked={meal.composition === 'custom'} onChange={e => edit({ composition: e.target.checked ? 'custom' : 'auto' })}/>明确指定荤、素、汤数量</label>{meal.composition === 'custom' && <div className="counts-fields">{(['meat', 'veg', 'soup'] as const).map(k => <label key={k}>{labels[k]}<input aria-label={`${labels[k]}道数`} type="number" min="0" max="6" step="1" value={Number.isNaN(meal.counts[k]) ? '' : meal.counts[k]} onChange={e => edit({ counts: { ...meal.counts, [k]: e.target.value === '' ? NaN : Number(e.target.value) } })}/></label>)}</div>}<p className="small">默认目标一荤两素，按食材与库存调整。自定义请明确每类数量，合计 1～6 道。</p></div>}
        {(result || busy) && <p className="result-conditions">{meal.servings || '待确认'} 人份 · {meal.includeAdditional ? '本人及附加限制并集' : '仅本人限制'} · {meal.allowBuy ? '已主动接受补买' : '不额外补买'}</p>}
        {busy && <div className="progress" role="status"><span className="spinner"/>{progress}</div>}
        {!result && !busy && <div className="results-empty empty-result"><div className="empty-plate" aria-hidden="true">🥬</div><h3>好好吃饭，从手边开始</h3><p>先确认左侧食材与偏好，<br/>让我们把这一餐搭配好。</p><div className="empty-steps"><span><b>1</b>确认食材</span><span><b>2</b>搭配一餐</span><span><b>3</b>照着做就好</span></div></div>}
        {result && <><div className={`result-state ${result.status === 'completed' ? '' : 'warning-box'}`} role="status"><strong>{result.status === 'completed' ? `已核验 ${result.dishes.length} 道${result.search === 'incomplete' ? ' · 搜索未完成' : ''}` : result.status === 'needs_confirmation' ? '还有信息需要核对' : result.status === 'no_results' ? '当前目录内未找到其他可行方案' : '本次推荐未完成'}</strong>{result.reasons.map(r => <p key={r}>{r}</p>)}{meal.health && <button onClick={() => edit({ health: false })}>主动返回普通模式</button>}</div>
          <div className="recipe-grid">{result.dishes.map((dish, index) => <article className="recipe-card" key={dish.recipe.id} data-testid="recipe-card"><div className="card-photo"><img src={`/assets/${dish.recipe.image}.png`} alt={`${dish.recipe.name}的餐食示意（非成品实拍）`} loading="lazy"/><span className="card-number">{String(index + 1).padStart(2, '0')}</span><button className="favorite-button" aria-label={`${favorites.some(f => f.recipeId === dish.recipe.id && f.variantId === dish.variant.id) ? '取消收藏' : '收藏'} ${dish.recipe.name}`} aria-pressed={favorites.some(f => f.recipeId === dish.recipe.id && f.variantId === dish.variant.id)} onClick={() => toggleFavorite(dish.recipe, dish.variant)}>♡</button><span className="image-caption">餐食示意</span></div><div className="card-body"><div className="card-tags"><span>{labels[dish.recipe.category]}</span><span>{dish.recipe.homeStyle ? '家常味' : '换个花样'}</span><span>{dish.recipe.minutes} 分钟</span></div><h4>{dish.recipe.name}</h4><p className="card-ingredients">{dish.variant.lines.filter(l => l.role === 'main').map(l => foodById.get(l.foodId)?.name).join(' · ')}</p><p className="small">{dish.checks.some(c => c.state === 'shortage' || c.state === 'missing') ? '需补买 · 见下方差额' : dish.checks.some(c => c.state === 'unverified') ? '食材种类匹配 · 数量未核实' : '当前用量已核对'}</p><CheckList checks={dish.checks.filter(c => c.state !== 'enough')}/><label className="flavor-label">单菜口味<select aria-label={`${dish.recipe.name}口味`} value={dish.variant.id} onChange={e => changeVariant(dish, e.target.value)}>{dish.recipe.variants.map(v => <option key={v.id} value={v.id}>{v.flavor}{meal.overrides[dish.recipe.id] === v.id ? ' · 手动选择' : ''}</option>)}</select></label><p className="nutrition-note">热量 {dish.nutrition.kcal === null ? '暂无法计算' : `${dish.nutrition.kcal} kcal / 当前人数整菜`}</p><div className="card-actions"><button onClick={() => setDetail({ recipe: dish.recipe, variant: dish.variant, checks: dish.checks, nutrition: dish.nutrition })}>看看做法 <span>↗</span></button>{meal.mode === 'meal' && <button aria-label={`替换 ${dish.recipe.name}`} onClick={() => void generate('replace', { replaceId: dish.recipe.id })}>换一道 ↻</button>}</div></div></article>)}</div>
          {result.checks.length > 0 && <details className="set-checks" open><summary>整套餐库存与补买核对</summary><CheckList checks={result.checks}/></details>}
          {result.dishes.length > 0 && <div className="result-actions">{meal.mode === 'meal' ? <button onClick={() => void generate('reroll')}>整套重推 ↻</button> : <><button disabled={result.page === 0} onClick={() => void generate('page', { page: result.page - 1, cursor: result.cursor })}>上一页</button><span>{result.page + 1} / {Math.max(1, Math.ceil(result.total / 6))}</span><button disabled={(result.page + 1) * 6 >= result.total} onClick={() => void generate('page', { page: result.page + 1, cursor: result.cursor })}>下一页</button></>}</div>}
          {result.search === 'incomplete' && <button onClick={() => void generate()}>主动重新查找</button>}
          <p className="small subtle result-note">构造内容用于开发测试；营养数据尚未准入。标准配方投料估算仅供参考，不代表实际摄入或健康适宜结论。</p>
        </>}
      </section></div>
      {notice && <div className="notice" role="status"><p>{notice}</p><button className="icon-button" aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      <section className="demo-lab"><div><span className="lab-label">体验实验室</span><span>试试不同场景，看看流程是否顺手</span></div><div className="scenario-buttons"><button onClick={() => enterDemo()}>日常一餐</button><button onClick={() => enterDemo('recognition')}>识别不完整</button><button onClick={() => enterDemo('shortage')}>食材不足</button><button onClick={() => enterDemo('allergy')}>过敏限制</button><button onClick={() => enterDemo('unsupported')}>疾病暂不支持</button><button onClick={() => enterDemo('combination')}>多疾病核对</button></div><button className="text-button reset-button" aria-label="清空 Demo 数据" onClick={() => setModal('clear')}>重置 Demo ↺</button></section>
      <p className="development">开发预览 · 当前 17 道构造菜谱用于流程验证。图片识别、真实账户及健康支持待准入。</p>
    </main><footer><span className="footer-brand">拾味 <span>把日子，过得有滋有味。</span></span><span>本机草稿 · 构造数据开发版</span></footer>
    {modal === 'account' && <Modal title="本机游客与账户" close={() => setModal(null)}><p>普通推荐、本机收藏和主动保存默认都可使用。</p><div className="warning-box">真实账户服务与跨设备同步尚未准入，当前不会模拟登录成功，也不会上传本机资料。</div><button onClick={() => setModal(null)}>继续安排本餐</button></Modal>}
    {modal === 'favorites' && <Modal title="我的本机收藏" close={() => setModal(null)}><p className="small">收藏保存菜谱与口味。再次打开按当前人数与限制复查，不代表永久适用。</p>{!favorites.length && <p className="empty-modal">看到喜欢的菜，点一下心形收藏。</p>}{favorites.map(f => { const r = recipes.find(r => r.id === f.recipeId), v = r?.variants.find(v => v.id === f.variantId); return <div className="favorite-row" key={favoriteKey(f)}><button onClick={() => void openFavorite(f)}>{r?.name ?? '内容已失效'} · {v?.flavor ?? '待核对'} ↗</button><button onClick={() => { const next = favorites.filter(x => favoriteKey(x) !== favoriteKey(f)); setFavorites(next); writeValue('shiwei:guest:favorites:v1', next); }}>移除</button></div>; })}</Modal>}
    {modal === 'health' && <Modal title="疾病名称与健康模式" close={() => setModal(null)}><div className="warning-box">疾病名称识别不等于支持。当前无已审核健康发布与真实账户，健康推荐保持关闭。</div><label htmlFor="disease-text">疾病名称草稿（未提交）</label><textarea id="disease-text" value={diseaseText} onChange={e => setDiseaseText(e.target.value)} placeholder="例如：高血压和糖尿病"/><div className="chips">{['高血压', '糖尿病', '痛风'].map(d => <button aria-pressed={meal.diseases.includes(d)} key={d} onClick={() => edit({ diseases: meal.diseases.includes(d) ? meal.diseases.filter(x => x !== d) : [...meal.diseases, d] })}>{d}</button>)}</div><p>名称记录：{meal.diseases.join('、') || '尚未记录'}</p><button onClick={() => { const found = Object.keys(diseaseAliases).filter(k => diseaseText.includes(k)).map(k => diseaseAliases[k]); edit({ diseases: [...new Set([...meal.diseases, ...found])] }); setNotice(found.length ? '已记录候选名称；不自动开启健康模式' : '名称无法核对，请保留草稿并修改'); }}>核对名称</button><label className="checkbox"><input type="checkbox" checked={meal.health} onChange={e => edit({ health: e.target.checked })}/>尝试健康模式（当前会提示尚未开放）</label><button className="primary" onClick={() => { edit({ health: false }); setModal(null); }}>主动使用普通模式，保留限制</button></Modal>}
    {modal === 'clear' && <Modal title="清空 Demo 数据？" close={() => setModal(null)}><p>只退出并清除当前临时演示。本机真实草稿、默认和收藏保留；不涉及云端资料。</p><div className="actions"><button onClick={() => setModal(null)}>取消</button><button className="primary" onClick={() => { if (demo) exitDemo(); setModal(null); setNotice('临时演示已清空，本机个人资料保留'); }}>确认清空演示</button></div></Modal>}
    {detail && <Modal title={detail.recipe.name} close={() => setDetail(null)}><p className="detail-meta">{detail.variant.flavor} · {meal.servings} 人份 · {detail.recipe.minutes} 分钟</p>{detail.message && <p role="status" className="warning-box">{detail.message}</p>}<img className="detail-photo" src={`/assets/${detail.recipe.image}.png`} alt="餐食示意，非成品实拍"/><p className="small subtle">开发构造配方 · 未作为正式发布内容</p><h3>这一餐的用量</h3><ul className="detail-lines">{detail.variant.lines.map((l, i) => <li key={`${l.foodId}-${i}`}><span>{foodById.get(l.foodId)?.name}{l.optional ? '（可省）' : ''}</span><span>{Math.round(l.amount * meal.servings / detail.recipe.servings * 1000) / 1000}{l.unit} · 可食净量</span></li>)}</ul>{detail.checks && <CheckList checks={detail.checks}/>}<h3>慢慢来，一步步做</h3><ol className="steps">{detail.variant.steps.map(s => <li key={s}>{s}</li>)}</ol><div className="nutrition-box"><h3>营养参考</h3><p>热量：{detail.nutrition?.kcal ?? '暂无法计算'}<br/>蛋白质：{detail.nutrition?.protein ?? '暂无法计算'}<br/>钠：{detail.nutrition?.sodium ?? '暂无法计算'}</p><p className="small">标准配方投料估算，仅供参考。按当前 {meal.servings} 人份整菜展示；尚无获准营养来源，缺项不补零。</p></div><button onClick={() => toggleFavorite(detail.recipe, detail.variant)}>收藏 / 取消收藏此口味 ♡</button></Modal>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);

