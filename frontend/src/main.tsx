import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { HealthAccountSettings } from './health-account-settings';
import { healthChatRecipes, expandFoodSuggestions, withoutExistingRestrictions } from '../../shared/health-guidance';
import { HealthChat } from './health-chat';
import { SavedAiFoods } from './ai-food-selection';
import { emptyAiChoices } from '../../shared/ai-food-choices';
import type { AiFoodChoices, HealthProfile } from '../../shared/health-chat';
import { combinedTopicChoices, healthTopics, toggleTopicGroup } from '../../shared/health-topics';
import { contentContext, type ContentContext } from '../../shared/content';
import { makeRestriction as makeRestrictionBase } from '../../shared/extraction';
import { inputIngredient, mergeInput, normalizeInput, resolveExtraction, contentSeasonings } from './meal-input';
import { type Dish, type Extraction, type Favorite, type Ingredient, type Meal, type QuantityCheck, type Recipe, type RecommendationRequest, type RecommendationResult, type Variant } from '../../shared/types';
import { fetchCatalog, extract, loginForLocalTest, logout, requestRecommendation } from './api';
import type { SessionInfo } from '../../shared/session';
import { compositionError, inputMode, servingReference, servingReferences } from '../../shared/meal-planning';
import { validateMeal } from './meal-validator.js';
import { galleryFavoriteKey, readFavorites, readGalleryFavorites, readMeal, STORAGE_KEY, writeGalleryFavorites, writeMeal, writeValue } from './storage';
import { CandidateLibrary } from './candidate-library';
import { DishImage, RecipePhoto } from './recipe-photo';
import { FoodPicker } from './food-picker';
import { availableFlavors } from '../../shared/flavors';
import { pantryGroups } from '../../shared/pantry';
import { SiteHeader } from './site-header';
import { PhotoInput } from './photo-input';
import { suggestPantryFoods, resolvePantryFood } from '../../shared/ingredient-matching';
import { recipeLineText, shoppingList } from './recipe-presentation';
import { AccountBanner, AccountControls } from './account-controls';
import { initializeAccount, setAccountCatalog, accountState, subscribeAccount, savePersonalSettings, flushHealthSettings } from './account-store';
import { applyPersonalSettings } from '../../shared/account';
import { defaultMeal } from '../../shared/types';
import {sameRecommendationInput} from '../../shared/recommendation-input';
import { readValue } from './storage';
import { storageKey } from './storage';
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
function ShoppingList({ items }: { items: string[] }) {
  return items.length ? <details className="shopping-list"><summary>补买 {items.length} 项</summary><ul className="checks" aria-label="这道菜需要补买">{items.map(text => <li key={text}>{text}</li>)}</ul></details> : null;
}
function App({ catalog, page = 'workspace' }: { catalog: ContentContext; page?: 'workspace' | 'favorites' }) {
  const { recipes, foods, categories, foodById } = catalog;
  const seasoningIds = contentSeasonings(catalog);
  const flavors = availableFlavors(recipes);
  const quickFlavors = ['不限', ...['清淡','微辣'].filter(f => flavors.includes(f))];
  const makeRestriction = (name: string, kind: Parameters<typeof makeRestrictionBase>[1], scope: 'self' | 'additional' = 'self') => makeRestrictionBase(name, kind, scope, catalog);
  const [meal, setMeal] = useState<Meal>(() => normalizeInput(applyPersonalSettings(readMeal(),accountState().local.defaults), catalog));
  const mealRef = useRef(meal); mealRef.current = meal;
  const [favorites, setFavorites] = useState<Favorite[]>(readFavorites);
  const favoritesRef = useRef(favorites); favoritesRef.current = favorites;
  const [favoriteFeedback, setFavoriteFeedback] = useState('');
  const account = useSyncExternalStore(subscribeAccount,accountState);
  const [testSession,setSessionInfo] = useState<SessionInfo | null>(null);
  const sessionInfo = testSession??account.session;
  const [authBusy, setAuthBusy] = useState(false);
  const [accountMode,setAccountMode]=useState<'login'|'register'>('login');
  const [authMessage, setAuthMessage] = useState('');
  const [loginReturn, setLoginReturn] = useState<'account' | 'health'>('account');
  const healthChatFocusPending = useRef(false);
  const healthIdentity = sessionInfo?.identity === 'account' ? sessionInfo.userId : sessionInfo?.identity === 'local-test' ? 'local-test' : '';
  useLayoutEffect(() => {
    if (!healthChatFocusPending.current || !meal.health || !healthIdentity) return;
    const panel = document.querySelector<HTMLElement>('.health-chat');
    if (panel) { healthChatFocusPending.current = false; panel.scrollIntoView({ block: 'start', behavior: 'instant' }); panel.focus({ preventScroll: true }); }
  }, [meal.health, healthIdentity]);
  const healthKey=account.cloud?.healthKey;
  useEffect(()=>{if(!healthKey?.configured&&mealRef.current.health)edit({health:false});},[healthKey?.configured]);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState('');
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(()=>{if(notice!=='健康模式已开启，可以和 AI 对话了')return;const timer=setTimeout(()=>setNotice(current=>current===notice?'':current),1800);return()=>clearTimeout(timer);},[notice]); const [storageError, setStorageError] = useState(false);
  const [crossTab, setCrossTab] = useState(false);
  const [entryOpen, setEntryOpen] = useState(true);
  const [tab, setTab] = useState<'text' | 'image'>('image');
  const [countsOpen, setCountsOpen] = useState(false);
  const [modal, setModal] = useState<'account' | 'login' | 'allergy' | 'avoid' | 'seasonings' | 'guide' | 'candidates' | null>(() => new URLSearchParams(location.search).get('settings') === '1' ? 'account' : null);
  const [detail, setDetail] = useState<{ recipe: Recipe; variant: Variant; checks?: QuantityCheck[]; nutrition?: Dish['nutrition']; message?: string } | null>(null);
  const [restrictionText, setRestrictionText] = useState('');
  const [restrictionScope, setRestrictionScope] = useState<'self' | 'additional'>('self');
  const controller = useRef<AbortController | null>(null); const operation = useRef('');
  const resultRef = useRef<HTMLElement>(null),resultStatusRef=useRef<HTMLDivElement>(null);
  const recipeGrid=useRef<HTMLDivElement>(null),pagePositionPending=useRef(false);
  useLayoutEffect(()=>{
    if(!pagePositionPending.current||busy||!result)return;
    pagePositionPending.current=false;
    const grid=result.dishes.length?recipeGrid.current:resultStatusRef.current;if(!grid)return;
    grid.focus({preventScroll:true});
    window.scrollTo({top:window.scrollY+grid.getBoundingClientRect().top-16,behavior:'instant'});
  },[result,busy]);
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  useEffect(() => { const observer = new IntersectionObserver(([entry]) => setWorkspaceVisible(entry.isIntersecting)); const el = document.getElementById('workspace'); if (el) observer.observe(el); return () => observer.disconnect(); }, []);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(()=>{const applied=()=>{setFavorites(readFavorites());const next=normalizeInput(applyPersonalSettings(readMeal(),accountState().local.defaults),catalog);controller.current?.abort();setBusy(false);setResult(null);mealRef.current=next;setMeal(next);};window.addEventListener('shiwei:account-applied',applied);return()=>window.removeEventListener('shiwei:account-applied',applied);},[]);
  useEffect(() => { if (!crossTab) setStorageError(!writeMeal(meal)); }, [meal, crossTab]);
  useEffect(() => {
    const handle = (event: StorageEvent) => { if (event.key === storageKey(STORAGE_KEY)) { controller.current?.abort(); operation.current = ''; setBusy(false); setResult(null); setCrossTab(true); } };
    window.addEventListener('storage', handle); return () => window.removeEventListener('storage', handle);
  }, []);
  const edit = (change: Partial<Meal> | ((m: Meal) => Meal), preserveResult=false) => {
    const previous = mealRef.current;
    const updated = typeof change === 'function' ? change(previous) : { ...previous, ...change };
    const planned={...updated,counts:updated.composition==='auto'?{...servingReference(updated.servings).counts}:updated.counts,mode:inputMode(updated)};
    const same=sameRecommendationInput(previous,planned);
    if(!same){controller.current?.abort(); operation.current = ''; setBusy(false); if(!preserveResult)setResult(null);}
    const next = { ...planned, version: previous.version + (same?0:1) };
    mealRef.current = next; setMeal(next); savePersonalSettings(next); return next;
  };
  useEffect(() => { if (sessionInfo?.identity === 'guest' && mealRef.current.health) edit({health:false}); }, [healthIdentity, sessionInfo?.identity]);
  const renameIngredient = (id: string, name: string) => {
    const current = mealRef.current.ingredients.find(i => i.id === id);
    if (!current) return;
    const food = resolvePantryFood(name, catalog.foodById);
    if(food)setNotice('已确认食材，可以继续搭配');
    const updated: Ingredient = { ...current, name, foodId: food?.id ?? null, form: food?.form ?? current.form, status: food ? 'confirmed' : 'pending', original: name };
    edit(m => ({ ...m, ingredients: mergeInput(m.ingredients.filter(i => i.id !== id), [updated]) }));
  };
  const active = meal.restrictions.filter(r => r.scope === 'self' || meal.includeAdditional);
  const initialHealthAssessment=useMemo(()=>{
    if(!meal.healthProfile)return undefined;
    const topics=healthTopics(meal.healthProfile,meal.aiFoodPreferences).map(topic=>({...topic,suggestions:withoutExistingRestrictions(expandFoodSuggestions(topic.suggestions,catalog),active.map(item=>item.name),catalog)}));
    const suggestions=topics.flatMap(topic=>topic.suggestions);
    const assessment={stage:'advice' as const,suggestions,topics,profile:{conditions:meal.healthProfile.conditions,goals:meal.healthProfile.goals,notes:meal.healthProfile.notes}};
    return {...assessment,recipes:healthChatRecipes(catalog,assessment,{ingredients:[],seasonings:[],restrictions:active.map(item=>item.name),allowBuy:false,aiExcludedFoods:meal.aiExcludedFoods,aiFoodPreferences:meal.aiFoodPreferences})};
  },[meal.healthProfile,meal.restrictions,meal.includeAdditional,meal.aiExcludedFoods,meal.aiFoodPreferences,catalog]);
  const pending = active.filter(r => r.status !== 'confirmed');
  const addParsed = (data: Extraction) => {
    const resolved = resolveExtraction(data, catalog);
    const parsed = resolved.ingredients;
    const added = mergeInput(mealRef.current.ingredients, parsed);
    const restrictions = [...mealRef.current.restrictions, ...resolved.restrictions.filter(n => !mealRef.current.restrictions.some(r => r.kind === n.kind && r.name === n.name && r.scope === n.scope))];
    if (added.length > 100 || restrictions.length > 50) { setNotice('食材最多 100 种，饮食要求最多 50 项，请分次整理；原输入已保留'); return; }
    edit(m => ({ ...m, ingredients: added,
      restrictions,
      diseases: [...new Set([...m.diseases, ...data.diseases])].slice(0, 20), servings: data.servings ?? m.servings }));
    if (parsed.length) setEntryOpen(true);
    const unrecognized = parsed.filter(i => !i.foodId).map(i => i.name);
    setNotice(data.restrictions.length ? '食材已加入。请打开过敏或忌口，确认识别到的饮食要求。'
      : unrecognized.length ? `有几项需要确认：${unrecognized.join('、')}。请在食材清单确认具体名称。`
      : data.ingredients.some(i => i.foodId && seasoningIds.includes(i.foodId)) ? '食材已加入，调料请在调料设置中管理。'
      : parsed.length ? '食材已加入，可以开始搭配了' : '没有找到食材，可以在下方手动添加');
  };
  const organize = async () => {
    if (!meal.raw.trim()) { setNotice('先写下手边的食材吧'); return; }
    const snapshot = mealRef.current.version;
    try { const data = await extract(meal.raw); if (snapshot === mealRef.current.version) addParsed(data); }
    catch (e) { setNotice((e as Error).message); }
  };
  const addManual = (value:string) => {
    const name = value.trim(); if (!name) return;
    if (meal.ingredients.length >= 100) { setNotice('最多添加 100 种食材，请先移除不需要的食材'); return; }
    const item = inputIngredient(name, catalog);
    if (item.foodId && seasoningIds.includes(item.foodId)) { setNotice('调料请在「调料」中选择，食材清单只放这餐要做的食材'); return; }
    edit(m => ({ ...m, ingredients: mergeInput(m.ingredients, [item]) })); setEntryOpen(true);
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
    if (snapshot.health && sessionInfo?.identity === 'guest') { setLoginReturn('health'); setAuthMessage('请先登录，再继续健康模式'); setModal(sessionInfo.localTestFeatures ? 'login' : 'account'); return; }
    if (crossTab) { setNotice('另一页面修改了本餐，请先选择要保留的内容'); return; }
    if (!Number.isInteger(snapshot.servings) || snapshot.servings < 1 || snapshot.servings > 12) { setNotice('人数须为 1～12 的整数'); document.getElementById('servings')?.focus(); return; }
    const countError = compositionError(snapshot);
    if (countError) { setCountsOpen(true); setNotice(countError); return; }
    controller.current?.abort(); const aborter = new AbortController(); controller.current = aborter;
    const operationId = fresh(); operation.current = operationId;
    const pageNumber=action==='page'?(extra.page??0)+1:undefined;
    const progressLabel=pageNumber===undefined?'正在挑选菜谱并检查搭配…':`正在加载第 ${pageNumber} 页菜谱…`;
    setBusy(true); setPendingRecipeId(action==='replace'?extra.replaceId??null:null); setNotice(''); setProgress(pageNumber===undefined?'正在提交本餐条件':progressLabel);
    const body: RecommendationRequest = { operationId, meal: snapshot, action, page: 0, previous: result?.dishes.map(d => d.recipe.id) ?? [], selected: result?.dishes.map(d => ({ recipeId: d.recipe.id, variantId: d.variant.id })) ?? [], ...(snapshot.health&&action==='replace'&&result?.cursor?{cursor:result.cursor}:{}), ...extra };
    try {
      if(snapshot.health){await flushHealthSettings();aborter.signal.throwIfAborted();}
      const next = await requestRecommendation(body, aborter.signal, stage => setProgress(pageNumber===undefined?stage:`${progressLabel} ${stage}`));
      if (operation.current !== operationId || mealRef.current.version !== snapshot.version) return;
      if (!next.changed && result) setNotice(next.reasons.map(friendly).join('；'));
      else { if((action==='page'&&next.dishes.length)||(snapshot.health&&(action==='generate'||action==='reroll')))pagePositionPending.current=true;setResult(next); if(!snapshot.health&&(action==='generate'||action==='reroll'))resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } catch (e) { if (!aborter.signal.aborted && operation.current === operationId) setNotice((e as Error).message); }
    finally { if (operation.current === operationId) { setBusy(false); setPendingRecipeId(null); } }
  };
  const applyAiFoodChoices = (choices: AiFoodChoices, recommendAfter: boolean) => {
    if (!mealRef.current.health) return false;
    if (Object.values(choices).some(items=>items.length>20)) {setNotice('每类 AI 食材选择最多20项，请先移除一些');return false;}
    const snapshot = edit({aiFoodChoices:choices});
    setNotice('已更新本餐 AI去疾 选择；过敏、忌口和补买设置未改变');
    if (recommendAfter) void generate('generate', {selected:[],previous:[]}, snapshot);
    return true;
  };
  const saveAiExcludedFoods = (foods:string[]) => {
    if(!mealRef.current.health||!healthIdentity)return false;
    if(foods.length>20){setNotice('个人AI去疾最多20项，请先移除一些');return false;}
    edit({aiExcludedFoods:[...new Set(foods)]});
    setNotice('已更新个人AI去疾，自动保存；过敏和忌口未改变');return true;
  };
  const changeHealthProfile=(profile:HealthProfile|undefined)=>{
    const preferences=profile?combinedTopicChoices(healthTopics(profile)):emptyAiChoices();
    if(Object.values(preferences).some(items=>items.length>20)){setNotice('每类综合食材选择最多20项，请先取消一些');return false;}
    edit({healthProfile:profile,aiFoodPreferences:preferences,aiFoodChoices:undefined,diseases:profile?.conditions??[],...(!profile?{aiExcludedFoods:[]}:{} )});return true;
  };
  const acceptAiGroup=(kind:keyof AiFoodChoices,names:string[],id?:string)=>{
    const profile=mealRef.current.healthProfile;if(!profile||!id)return false;
    const updated=toggleTopicGroup(profile,mealRef.current.aiFoodPreferences,id,kind,names);
    const success=changeHealthProfile(updated);if(success)setNotice('已更新这项健康关注或目标的食材选择');return success;
  };
  const openAiRecipe=(recipeId:string,variantId:string)=>{
    const recipe=recipes.find(item=>item.id===recipeId),variant=recipe?.variants.find(item=>item.id===variantId);
    if(recipe?.state==='published'&&variant){setFavoriteFeedback('');setDetail({recipe,variant,message:'搭配示例；安排本餐时会按现有食材和补买选择筛选。'});}
  };
  const newMeal = () => { edit(normalizeInput(applyPersonalSettings(defaultMeal(),accountState().local.defaults??mealRef.current), catalog)); setEntryOpen(true); setNotice('已开始新一餐'); };
  const isFavorite = (recipe: Recipe, variant: Variant) => favorites.some(f => f.recipeId === recipe.id && f.variantId === variant.id);
  const toggleFavorite = (recipe: Recipe, variant: Variant) => {
    const f = { recipeId: recipe.id, variantId: variant.id }, key = favoriteKey(f);
    const current = favoritesRef.current;
    const existed = current.some(v => favoriteKey(v) === key);
    const next = existed ? current.filter(v => favoriteKey(v) !== key) : [...current, f];
    const saved = writeValue('shiwei:guest:favorites:v1', next);
    const galleryFavorites=readGalleryFavorites(),galleryKey=galleryFavoriteKey(recipe.name,variant.flavor);
    const galleryNext=existed?galleryFavorites.filter(v=>v!==galleryKey):[...new Set([...galleryFavorites,galleryKey])];
    const gallerySaved=writeGalleryFavorites(galleryNext);
    favoritesRef.current = next; setFavorites(next);
    const message = `${existed ? '已取消收藏' : '已收藏'}：${recipe.name} · ${variant.flavor}${saved&&gallerySaved ? '' : '（当前页面有效，浏览器未允许完整保存）'}`;
    setFavoriteFeedback(message); if (!detail) setNotice(message);
    if (!saved) setStorageError(true);
  };
  const login = async () => {
    setAuthBusy(true); setAuthMessage('');
    try {
      const current = await loginForLocalTest(); setSessionInfo(current); setAuthMessage('');
      if (loginReturn === 'health') { setModal('account'); setNotice('已登录，请填写 DeepSeek API Key'); }
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
    if (!sessionInfo || sessionInfo.identity === 'guest') { setLoginReturn('health'); setAuthMessage(''); setModal(sessionInfo?.localTestFeatures ? 'login' : 'account'); return; }
    if(mealRef.current.health){edit({health:false});setNotice('已关闭健康模式');return;}
    if(!healthKey?.configured){setNotice('请先在个人设置中填写 DeepSeek Key，再开启健康模式');setModal('account');return;}
    healthChatFocusPending.current = true; edit({ health: true }); setModal(null); setNotice('健康模式已开启，可以和 AI 对话了');
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
      setDetail({ recipe, variant, checks: dish?.checks, nutrition: dish?.nutrition, message: dish ? undefined : checked.reasons.map(friendly).join('；') });
    } catch (e) { setDetail({ recipe, variant, message: `暂时无法确认这道菜是否适合你：${(e as Error).message}` }); }
  };
  const changeVariant = async (dish: Dish, variantId: string) => {
    if(busy||!result||crossTab)return;
    const current=mealRef.current,overrides={...current.overrides,[dish.recipe.id]:variantId};
    controller.current?.abort();const aborter=new AbortController();controller.current=aborter;
    const operationId=fresh();operation.current=operationId;
    setBusy(true);setPendingRecipeId(dish.recipe.id);setNotice('');
    try{
      const next=await requestRecommendation({operationId,meal:{...current,overrides},action:'variant',page:result.page,
        selected:result.dishes.map(d=>({recipeId:d.recipe.id,variantId:d.variant.id})),cursor:result.cursor,previous:[]},aborter.signal,()=>{});
      if(operation.current!==operationId||mealRef.current.version!==current.version)return;
      const updatedDish=next.dishes.find(d=>d.recipe.id===dish.recipe.id);
      if(!next.changed||!updatedDish){setNotice(next.reasons.map(friendly).join('；'));return;}
      const updated=edit({overrides},true);
      setResult(previous=>previous?{...previous,operationId,mealVersion:updated.version,cursor:next.cursor,checks:next.checks,
        dishes:previous.dishes.map(d=>d.recipe.id===dish.recipe.id?updatedDish:d)}:previous);
      setPendingRecipeId(null);
    }catch(error){if(!aborter.signal.aborted&&operation.current===operationId)setNotice((error as Error).message);}
    finally{if(operation.current===operationId){setBusy(false);setPendingRecipeId(null);}}
  };
  const deleteRestriction = (id: string) => edit(m => ({ ...m, restrictions: m.restrictions.filter(r => r.id !== id) }));
  const nav = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return <>
    <a className="skip" href={page === 'workspace' ? '#workspace' : '#saved-recipes'}>跳到{page === 'workspace' ? '本餐工作台' : '我的收藏'}</a>
    <SiteHeader page={page} count={favorites.length} signedIn={sessionInfo?.identity === 'local-test'||sessionInfo?.identity === 'account'} settings={() => { setNotice(''); setModal('account'); }}/>
    <main>
      {page === 'favorites' ? <section id="saved-recipes" className="saved-recipes"><h1>我的收藏</h1><p>收藏保存菜谱与口味，做法和用量保持不变。打开时会核对当前食材及饮食要求。</p>{!favorites.length && <p className="empty-modal">看到喜欢的菜，点一下心形收藏。</p>}{favorites.map(f => { const r = recipes.find(r => r.id === f.recipeId), v = r?.variants.find(v => v.id === f.variantId); return <div className="favorite-row" key={favoriteKey(f)}><button className="favorite-open" aria-label={`打开 ${r?.name ?? '内容已失效'} · ${v?.flavor ?? '待核对'}`} onClick={() => void openFavorite(f)}><DishImage name={r?.name??'内容已失效'} src={r?.imageUrl} className="favorite-thumb" fallback={<span className="favorite-thumb-empty" aria-hidden="true">拾味</span>}/><span className="favorite-open-copy"><strong>{r?.name ?? '内容已失效'}</strong><small>{v?.flavor ?? '待核对'} · 打开做法 ↗</small></span></button><button className="favorite-remove" aria-label={`移除收藏 ${r?.name ?? '内容已失效'}`} onClick={() => { const next = favoritesRef.current.filter(x => favoriteKey(x) !== favoriteKey(f)); favoritesRef.current = next; setFavorites(next); if (!writeValue('shiwei:guest:favorites:v1', next)) setNotice('当前页面已移除，浏览器未允许保存'); if(r&&v)writeGalleryFavorites(readGalleryFavorites().filter(k=>k!==galleryFavoriteKey(r.name,v.flavor))); }}>移除</button></div>; })}</section> : <>
      <section className="page-intro"><div><div className="eyebrow">A LITTLE INSPIRATION, EVERY DAY</div><h1>今天，吃点什么？<span className="sun-icon" aria-hidden="true">✳</span></h1><p>打开冰箱，把手边的食材变成一顿好饭。</p></div><button className="health-entry" onClick={enableHealth}><span className="health-symbol" aria-hidden="true">♡</span><span><strong>健康模式</strong><small>{meal.health ? '已开启 · AI 对话' : healthKey?.configured ? '点击开启' : healthIdentity ? '请在个人设置填写 Key' : '登录后开启'}</small></span><span className={`switch ${meal.health ? 'on' : ''}`} aria-hidden="true"/></button></section>
      <section className="hero-banner"><div className="hero-copy"><span className="hero-tag"><i/> 少一点纠结，多一点烟火气</span><h2>有啥，做啥。<br/>好好吃一餐。</h2><p>食材不浪费，搭配刚刚好。</p></div><div className="hero-photo" role="img" aria-label="番茄炒蛋、时蔬和汤的家常餐食示意"><div className="photo-note">家常滋味 · 图片为示意</div></div><span className="hero-doodle" aria-hidden="true">✳</span></section>
      {crossTab && <div className="warning-box" role="alert">另一页面更新了这一餐，请选择使用哪份内容。<div className="actions"><button onClick={() => { const restored = normalizeInput(applyPersonalSettings(readMeal(),accountState().local.defaults), catalog); setCrossTab(false); edit(restored); }}>载入另一页面版本</button><button onClick={() => { setCrossTab(false); edit({}); }}>保留当前编辑并写回</button></div></div>}
      {storageError && <p role="alert" className="warning-box">浏览器未允许本机保存。当前页面可继续，刷新可能无法恢复。</p>}
      <div id="workspace" className="workspace"><div className="input-column"><section className="panel ingredient-panel"><div className="section-heading"><h2><span className="step-number">01</span>看看有什么食材</h2><span className="subtle">{meal.ingredients.length} 种</span></div>
          <div className="input-tabs" role="group" aria-label="输入方式"><button className={tab === 'image' ? 'selected' : ''} aria-pressed={tab === 'image'} onClick={() => { setTab('image'); setEntryOpen(true); }}>拍照识别</button><button className={tab === 'text' ? 'selected' : ''} aria-pressed={tab === 'text'} onClick={() => { setTab('text'); setEntryOpen(true); }}>文字输入</button></div>
          {(entryOpen || tab === 'image') && (tab === 'text' ? <><label className="sr-only" htmlFor="raw">输入食材与本餐信息</label><textarea id="raw" maxLength={5000} value={meal.raw} onChange={e => edit({ raw: e.target.value })} placeholder="例如：西红柿、鸡蛋、菠菜，2个人吃，对虾过敏"/><button className="button outline full organize-button" onClick={() => void organize()}>整理信息 ↗</button></> : <div className="upload-zone"><span className="upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="16" cy="9" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/></svg></span><strong>拍照或上传食材图片</strong><span>识别后确认食材，再加入本餐清单</span><PhotoInput onAdd={addParsed} provider={sessionInfo?.imageRecognitionProvider} userId={sessionInfo?.userId} configured={Boolean(healthKey?.configured)} version={meal.version}/><button className="text-button" onClick={() => { setTab('text'); setEntryOpen(true); }}>转到文字录入 →</button></div>)}
          <div className="ingredient-heading list-label"><strong>我的食材</strong></div>
          {!meal.ingredients.length && <div className="ingredient-empty">添加现有食材，或允许补买查看默认推荐</div>}
          <ul className="ingredients" aria-label="我的食材">{meal.ingredients.map(i => { return <li key={i.id}><div className="ingredient-row">
            {i.foodId ? <span className="ingredient-name" title={i.name}>{i.name}</span> : <input className="ingredient-name-edit" aria-label={`更正未识别名称 ${i.name}`} list="food-names" maxLength={100} value={i.name} onChange={e => renameIngredient(i.id,e.target.value)}/>}
            <button className="icon-button" aria-label={`删除食材 ${i.name}`} onClick={() => edit(m => ({ ...m, ingredients: m.ingredients.filter(x => x.id !== i.id) }))}>×</button></div>
            {!i.foodId && <p className="ingredient-unrecognized">请确认具体食材；确认后参与推荐</p>}
            {!i.foodId && <div className="chips" aria-label={`匹配 ${i.name}`}>{suggestPantryFoods(i.name,catalog.foodById).map(food=><button key={food.id} type="button" onClick={()=>renameIngredient(i.id,food.name)}>{food.name}</button>)}</div>}
          </li>; })}</ul>
          <FoodPicker foods={foods} add={addManual}/>
          <datalist id="food-names">{foods.filter(f => !seasoningIds.includes(f.id)).map(f => <option key={f.id} value={f.name}/>)}</datalist>
        </section>
        <section className="panel preferences"><div className="section-heading"><h2><span className="step-number">02</span>这一餐的偏好</h2><button className="text-button" onClick={() => (setNotice(''), setModal('account'))}>个人设置 ↗</button></div>
          <div className="setting-row"><div className="servings-label"><label htmlFor="servings">几个人吃</label><button className="serving-guide-link" aria-label={`${meal.servings || 1} 人配菜参考 · 查看人数表`} onClick={() => setModal('guide')}>配菜参考 ↗</button></div><div className="stepper"><button aria-label="减少人数" onClick={() => edit({ servings: Math.max(1, (meal.servings || 1) - 1) })}>−</button><input id="servings" type="number" min="1" max="12" step="1" value={Number.isNaN(meal.servings) ? '' : meal.servings} onChange={e => edit({ servings: e.target.value === '' ? NaN : Number(e.target.value) })}/><button aria-label="增加人数" onClick={() => edit({ servings: Math.min(12, (meal.servings || 1) + 1) })}>＋</button></div></div>
          {(!Number.isInteger(meal.servings) || meal.servings < 1 || meal.servings > 12) && <p role="alert" className="warning">人数须为 1～12 的整数</p>}
          <fieldset className="flavor-setting"><legend>今天的口味</legend><div className="chips flavor-options">{quickFlavors.map(f => <button className={`flavor-button ${meal.flavor === f ? 'active' : ''}`} key={f} aria-pressed={meal.flavor === f} onClick={() => edit({ flavor: f })}>{f}</button>)}<select aria-label="更多口味" className="more-flavors" value={quickFlavors.includes(meal.flavor) ? '' : meal.flavor} onChange={e => { if(e.target.value) edit({flavor:e.target.value}); }}><option value="">更多</option>{flavors.filter(f=>!quickFlavors.includes(f)).map(f=><option key={f}>{f}</option>)}</select></div></fieldset>
          <div className="preference-shortcuts">{(['allergy', 'avoid'] as const).map(kind => { const list = active.filter(r => r.kind === kind || (kind === 'avoid' && r.kind === 'unclassified')); return <button key={kind} onClick={() => showSettings(kind)}><span>{kind === 'allergy' ? '过敏' : '忌口'}</span><small>{list.length ? `${list.length} 项${list.some(r => r.status !== 'confirmed') ? ' · 待确认' : ''}` : '未设置'} <span aria-hidden="true">›</span></small></button>; })}<button onClick={() => setModal('seasonings')}><span>调料</span><small>{meal.checkSeasonings ? `${meal.seasonings.length} 种现有` : '不限库存'} <span aria-hidden="true">›</span></small></button></div>
          <label className="checkbox purchase-setting"><input type="checkbox" checked={meal.allowBuy} onChange={e => edit({ allowBuy: e.target.checked })}/><span>允许补买食材<small>{meal.composition === 'custom' ? '按指定荤素汤数量搭配，缺少的列入补买清单' : meal.allowBuy ? '列出更多菜谱，并标明需要补买什么' : '只用现有食材，直接搭配一餐'}</small></span></label>
          <div className="generate-bar"><button className="button primary full generate-button" aria-label="安排这一餐" disabled={busy || crossTab} onClick={() => void generate()}>{busy ? '正在搭配…' : meal.health ? '请 AI 搭配这一餐' : meal.composition === 'custom' ? '按指定数量搭配' : meal.allowBuy ? '看看可以做什么' : '搭配这一餐'} <span>✧</span></button>{busy && <button className="text-button" onClick={() => { controller.current?.abort(); operation.current = ''; setBusy(false); setNotice('已取消，输入保留'); }}>取消</button>}</div>
        </section>
      </div>
      <section ref={resultRef} id="results" className={`results-column${meal.health?' health-results':''}`} aria-label="本餐推荐">{healthIdentity && <div hidden={!meal.health}><HealthChat key={healthIdentity} configured={Boolean(healthKey?.configured)||Boolean(sessionInfo?.healthGuidanceResearch)} research={sessionInfo?.healthGuidanceResearch} last4={healthKey?.last4} profile={meal.healthProfile} initialAssessment={initialHealthAssessment} diseases={meal.diseases} choices={meal.aiFoodChoices} onApply={applyAiFoodChoices} savedFoods={meal.aiExcludedFoods??[]} onSave={saveAiExcludedFoods} accepted={meal.aiFoodPreferences} onAccept={acceptAiGroup} recipes={recipes} onOpenRecipe={openAiRecipe} mealContext={{ingredients:meal.ingredients.filter(item=>item.status==='confirmed').map(item=>item.name),seasonings:meal.seasonings.flatMap(id=>foodById.get(id)?[foodById.get(id)!.name]:[]),restrictions:active.map(item=>`${item.kind==='allergy'?'过敏':item.kind==='avoid'?'忌口':'待确认'}：${item.name}`),allowBuy:meal.allowBuy,checkSeasonings:meal.checkSeasonings,servings:meal.servings,aiFoodChoices:meal.aiFoodChoices,aiExcludedFoods:meal.aiExcludedFoods,aiFoodPreferences:meal.aiFoodPreferences}} configure={() => {setAuthMessage('');setModal('account');}} expired={() => {edit({health:false});setLoginReturn('health');setModal(sessionInfo?.localTestFeatures?'login':'account');}}/></div>}<div className="results-heading"><div><div className="eyebrow">MADE FOR YOUR TABLE</div><h2>这一餐，安排好了</h2></div><span className="subtle">从手边食材开始</span></div><div className="result-toolbar"><div className="recommendation-mode"><strong>{meal.composition === 'custom' ? '按需搭配' : meal.allowBuy ? '更多菜谱' : '一键搭配'}</strong><small>{meal.composition === 'custom' ? '按你指定的荤、素、汤数量搭配一餐' : meal.allowBuy ? '复用现有食材，缺少的列入补买清单 · 每页 6 道可选菜谱' : '按人数、食材种类和饮食要求搭配'}</small></div><div className="toolbar-actions"><button className="text-button" onClick={newMeal}>开始新一餐 ↻</button><button className="text-button" aria-expanded={countsOpen} aria-controls="custom-counts" onClick={() => setCountsOpen(!countsOpen)}>荤素汤搭配 ⌄</button></div></div>
        {countsOpen && <div id="custom-counts" className="count-settings"><label className="checkbox"><input type="checkbox" checked={meal.composition === 'custom'} onChange={e => { setNotice(''); edit({ composition: e.target.checked ? 'custom' : 'auto' }); }}/>明确指定荤、素、汤数量</label>{meal.composition === 'custom' ? <><div className="counts-fields">{(['meat', 'veg', 'soup'] as const).map(k => <label key={k}>{labels[k]}<input aria-label={`${labels[k]}道数`} type="number" min="0" max="20" step="1" value={Number.isNaN(meal.counts[k]) ? '' : meal.counts[k]} onChange={e => { setNotice(''); edit({ counts: { ...meal.counts, [k]: e.target.value === '' ? NaN : Number(e.target.value) } }); }}/></label>)}</div><p className="small">合计 1～20 道，不需要的类别填 0。食材不足会告知；允许补买后按指定数量搭配。</p></> : <p className="small">自动根据人数、食材种类和饮食要求决定菜数，尽量贴近人数参考，不固定为三道或六道。填写用量仅供参考。</p>}<button className="text-button" onClick={() => setModal('guide')}>查看 1～12 人配菜参考 ↗</button></div>}
        {meal.health && <div className="health-results-note" role="note"><span>AI 会结合你的饮食档案、现有食材和补买设置来选菜；开始搭配会使用你的 DeepSeek 用量</span><button onClick={()=>edit({health:false})}>切回普通模式</button></div>}{(result || busy) && <p className="result-conditions">{meal.servings || '待确认'} 人用餐 · {meal.includeAdditional ? '也照顾同餐人的饮食要求' : '按我的饮食要求'} · {meal.allowBuy ? '允许补买' : '不额外补买'}</p>}
        {busy && !pendingRecipeId && <div className="progress" role="status"><span className="spinner"/>{progress}</div>}
        {!result && !busy && <div className="results-empty empty-result"><div className="empty-plate" aria-hidden="true">🥬</div><h3>好好吃饭，从手边开始</h3><p>添加手边食材，选好口味，<br/>让我们把这一餐搭配好。</p><div className="empty-steps"><span><b>1</b>添加食材</span><span><b>2</b>搭配一餐</span><span><b>3</b>照着做就好</span></div></div>}
        {result && <><div ref={resultStatusRef} tabIndex={-1} className={`result-state ${result.status === 'completed' ? '' : 'warning-box'}`} role="status"><strong>{result.status === 'completed' ? `为你找到 ${result.dishes.length} 道` : result.status === 'needs_confirmation' ? '还有信息需要核对' : result.status === 'no_results' ? '暂时没有合适的搭配' : '本次推荐未完成'}</strong>{result.healthAssessment?.state==='model_selected'&&<p className="ai-meal-summary">{result.healthAssessment.message}</p>}{result.reasons.map(r => <p key={r}>{friendly(r)}</p>)}{meal.composition === 'custom' && !meal.allowBuy && !result.targetMet && ['completed', 'no_results'].includes(result.status) && <button className="buy-to-complete" onClick={() => { const snapshot = edit({ allowBuy: true }); void generate('generate', { selected: [], previous: [] }, snapshot); }}>允许补买，按指定数量搭配</button>}{meal.health && <button onClick={() => edit({ health: false })}>主动返回普通模式</button>}</div>
          <div className="recipe-grid" ref={recipeGrid} tabIndex={-1} aria-label="推荐菜谱">{result.dishes.map(dish => <article className="recipe-card" key={dish.recipe.id} data-testid="recipe-card" aria-busy={busy&&pendingRecipeId===dish.recipe.id}>
            <div className="card-photo"><RecipePhoto recipe={dish.recipe}/><FavoriteControl compact recipe={dish.recipe} variant={dish.variant} active={isFavorite(dish.recipe, dish.variant)} toggle={() => toggleFavorite(dish.recipe, dish.variant)}/></div>
            <div className="card-body">
              <h4>{dish.recipe.name}</h4><div className="card-tags"><span>{labels[dish.recipe.category]}</span><span>{dish.recipe.homeStyle ? '家常菜' : '换个花样'}</span>{dish.recipe.minutes !== null && <span>{dish.recipe.minutes} 分钟</span>}</div>
              <p className="card-ingredients">{[...new Set(dish.variant.lines.filter(l => l.role === 'main').map(l => foodById.get(l.foodId)?.name))].join(' · ')}</p>
              {dish.aiReason&&<p className="ai-recipe-reason"><strong>AI 建议理由</strong>{dish.aiReason}</p>}{dish.aiBasis?.length ? <details className="small"><summary>本餐核对依据</summary>{dish.aiBasis.map(basis=><p key={basis}>{basis}</p>)}</details> : null}<div className="card-options"><label className="card-flavor"><span className="sr-only">单菜口味</span>{dish.recipe.variants.length > 1 ? <select aria-label={`${dish.recipe.name}口味`} disabled={busy} value={dish.variant.id} onChange={e => void changeVariant(dish, e.target.value)}>{dish.recipe.variants.map(v => <option key={v.id} value={v.id}>{v.flavor}</option>)}</select> : <span>{dish.variant.flavor}</span>}</label><ShoppingList items={shoppingList([dish],meal,foodById)}/></div>
              {dish.nutrition.kcal !== null && <p className="nutrition-note">热量 {dish.nutrition.kcal} kcal / 整道菜</p>}
              <div className="card-actions"><button disabled={busy&&pendingRecipeId===dish.recipe.id} onClick={() => { setFavoriteFeedback(''); setDetail({ recipe: dish.recipe, variant: dish.variant, checks: dish.checks, nutrition: dish.nutrition }); }}>看看做法 <span>↗</span></button>{meal.mode === 'meal' && <button aria-label={`替换 ${dish.recipe.name}`} disabled={busy} aria-busy={busy&&pendingRecipeId===dish.recipe.id} onClick={() => void generate('replace', { replaceId: dish.recipe.id })}>{busy&&pendingRecipeId===dish.recipe.id?'更新中…':'换一道 ↻'}</button>}</div>
            </div>
          </article>)}</div>
          {shoppingList(result.dishes,meal,foodById).length > 0 && <details className="set-checks"><summary>本餐补买清单</summary><ul className="checks">{shoppingList(result.dishes,meal,foodById).map(text => <li key={text}>{text}</li>)}</ul></details>}
          {result.dishes.length > 0 && <div className="result-actions">{meal.mode === 'meal' ? <button onClick={() => void generate('reroll')}>整套重推 ↻</button> : <><button disabled={busy||result.page === 0} onClick={() => void generate('page', { page: result.page - 1, cursor: result.cursor })}>上一页</button><span>{result.page + 1} / {Math.max(1, Math.ceil(result.total / 6))}</span><button disabled={busy||(result.page + 1) * 6 >= result.total} onClick={() => void generate('page', { page: result.page + 1, cursor: result.cursor })}>{busy&&progress.startsWith('正在加载第 ')?progress.match(/^正在加载第 \d+ 页/)?.[0]:'下一页'}</button></>}</div>}
          {result.selectionScope&&!result.selectionScope.complete&&<p className="small subtle">这次只比较了部分菜谱和口味。可以先看当前结果，或重新选择一次。</p>}
          {result.search === 'incomplete' && <button onClick={() => void generate()}>主动重新查找</button>}
          <p className="small subtle result-note">菜谱用量供参考，请根据实际食材和人数调整。</p>
        </>}
      </section></div>
      </>}
      {notice && <div className="notice" role="status"><p>{notice}</p><button className="icon-button" aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    </main><footer><span className="footer-brand">拾味 <span>把日子，过得有滋有味。</span></span><span>好好吃饭，好好生活。</span></footer>
    {workspaceVisible && <div className="mobile-cta"><button className="primary" disabled={busy || crossTab} onClick={() => void generate()}>{busy ? '正在搭配…' : meal.allowBuy ? '看看可以做什么' : '搭配这一餐'} <span>{meal.ingredients.length} 种食材 · {Number.isFinite(meal.servings) ? meal.servings : '—'} 人用餐</span></button></div>}
    {modal === 'account' && <Modal title={sessionInfo?.identity === 'account'||sessionInfo?.localTestFeatures ? '个人设置' : accountMode === 'register' ? '注册账号' : '登录'} close={() => {setModal(null);setAccountMode('login');}}>{sessionInfo?.identity === 'account'&&<p className="small">口味、过敏、忌口、调料和经你同意的AI去疾会自动保存。</p>}{sessionInfo?.accountAvailable && !sessionInfo.localTestFeatures ? <AccountControls catalog={catalog} onModeChange={setAccountMode} onAuthenticated={() => {if(loginReturn==='health'){history.replaceState({},'','/#workspace');setLoginReturn('account');setAuthMessage('');setModal('account');}}}/> : sessionInfo?.identity === 'local-test' ? <><p className="account-state">✓ 已登录 · 本机测试账号</p><p className="small subtle">当前浏览器中保留登录状态；跨设备同步尚未接入。</p><button disabled={authBusy} onClick={() => void signOut()}>{authBusy ? '正在退出…' : '退出登录'}</button></> : <><p>{sessionInfo?.localTestFeatures ? '登录测试账号，体验健康模式。食材、偏好和收藏继续保留。' : '账户登录和跨设备同步暂不可用。'}</p>{sessionInfo?.localTestFeatures && <button className="primary" onClick={() => { setLoginReturn('account'); setAuthMessage(''); setModal('login'); }}>登录</button>}</>}{healthIdentity&&sessionInfo?.identity==='account'&&<HealthAccountSettings configured={Boolean(healthKey?.configured)} last4={healthKey?.last4} profile={meal.healthProfile} preferences={meal.aiFoodPreferences} isMatchable={name=>catalog.restrictionTargets(name).length>0} onProfileChange={changeHealthProfile}/>} {meal.health&&healthIdentity&&<SavedAiFoods foods={meal.aiExcludedFoods??[]} onChange={saveAiExcludedFoods}/>} {authMessage && <p role="status">{authMessage}</p>}</Modal>}
    {(modal === 'allergy' || modal === 'avoid') && <Modal title={modal === 'allergy' ? '过敏设置' : '忌口设置'} close={() => setModal(null)}>
      <p>{modal === 'allergy' ? '添加会引起过敏的食物，确认后会避开相关菜谱。' : '添加不想吃或不能吃的食物，确认后会避开相关菜谱。'}</p>
      {catalog.restrictionScope==='listed-foods' && <p className="small subtle">按菜谱列出的食材和调料筛选。</p>}
      <form className="restriction-add" onSubmit={e => { e.preventDefault(); addRestriction(); }}><label>为谁设置<select aria-label="为谁设置" value={restrictionScope} onChange={e => setRestrictionScope(e.target.value as 'self' | 'additional')}><option value="self">我自己</option><option value="additional">一起吃饭的人</option></select></label><label>{modal === 'allergy' ? '过敏食物' : '忌口食物'}<input aria-label={modal === 'allergy' ? '过敏食物' : '忌口食物'} maxLength={200} value={restrictionText} onChange={e => setRestrictionText(e.target.value)} placeholder="输入食物名称"/></label><button className="primary" disabled={!restrictionText.trim()}>确认添加</button></form>
      {notice && <p role="status" className="modal-feedback">{notice}</p>}<ul className="restrictions">{meal.restrictions.filter(r => r.kind === modal || (modal === 'avoid' && r.kind === 'unclassified')).map(r => <li key={r.id}><div><strong>{r.name.replace(/^未分类：/, '')}</strong> <span className="small">{r.scope === 'self' ? '我自己' : '一起吃饭的人'}</span></div><p>{r.status === 'confirmed' ? '会避开：' : r.targets.length ? '请确认要避开的食物：' : '还没认出这个食物，请删除后换个名称。'}{r.targets.map(t => foodById.get(t)?.name).join('、')}</p>{r.targets.length > 1 && <p className="small subtle">目前可识别以上食物，如有其他需要避开的食物，请单独添加。</p>}<div className="actions">{r.targets.length > 0 && r.status === 'pending' && <button onClick={() => edit(m => ({ ...m, restrictions: m.restrictions.map(x => x.id === r.id ? { ...x, status: 'confirmed' } : x) }))}>确认避开这些食物</button>}{r.kind === 'unclassified' && r.status !== 'conflict' && <button onClick={() => { const name = r.name.replace(/^未分类：/, ''); if (meal.ingredients.length >= 100) { setNotice('食材已达 100 种，请先移除不需要的食材'); return; } edit(m => ({ ...m, restrictions: m.restrictions.filter(x => x.id !== r.id), ingredients: mergeInput(m.ingredients, [inputIngredient(name, catalog)]) })); }}>这是食材，加入清单</button>}<button onClick={() => deleteRestriction(r.id)}>移除</button></div></li>)}</ul>
      <label className="checkbox"><input type="checkbox" checked={meal.includeAdditional} onChange={e => edit({ includeAdditional: e.target.checked })}/>这顿饭也照顾同行人的过敏和忌口</label><p className="small subtle">默认只使用你的饮食要求。勾选后，一起吃饭的人的过敏和忌口也会用于本餐。</p><button onClick={() => setModal(null)}>完成</button>
    </Modal>}
    {modal === 'guide' && <Modal title="人数与配菜参考" close={() => setModal(null)}><p>人数只用于参考菜数，每道菜的做法和用量保持不变。实际菜数会随食材种类和饮食要求调整，不要求凑齐。填写用量不影响选菜。</p><table className="serving-table"><caption>1～12 人配菜参考</caption><thead><tr><th scope="col">人数</th><th scope="col">荤菜</th><th scope="col">素菜</th><th scope="col">汤品</th><th scope="col">合计</th></tr></thead><tbody>{servingReferences.map(r => <tr key={r.servings} aria-current={r.servings === meal.servings ? 'true' : undefined}><th scope="row">{r.servings} 人</th><td>{r.counts.meat}</td><td>{r.counts.veg}</td><td>{r.counts.soup || '—'}</td><td>{r.total} 道</td></tr>)}</tbody></table><p className="small subtle">这是做饭搭配参考，不是食量或营养标准。需要招待或多做几道时，可指定荤素汤数量，最多 20 道。</p><button onClick={() => setModal(null)}>知道了</button></Modal>}
    {modal === 'seasonings' && <Modal title="调料设置" close={() => setModal(null)}><label className="checkbox"><input type="checkbox" checked={meal.checkSeasonings} onChange={e => edit({ checkSeasonings: e.target.checked })}/>只使用家里现有的调料</label><p className="small">开启后，请勾选家里有的调料；关闭时不核对调料库存。过敏和忌口始终生效。</p>{meal.checkSeasonings && <div className="pantry-groups">{[...pantryGroups, {name:"其他调料",ids:seasoningIds.filter(id=>!pantryGroups.some(g=>g.ids.includes(id)))}].map(group => { const ids=group.ids.filter(id=>seasoningIds.includes(id)); return ids.length ? <fieldset key={group.name}><legend>{group.name}</legend><div className="seasonings">{ids.map(id => <label className="checkbox" key={id}><input type="checkbox" checked={meal.seasonings.includes(id)} onChange={e => edit({ seasonings: e.target.checked ? [...meal.seasonings, id] : meal.seasonings.filter(s => s !== id) })}/>{foodById.get(id)?.name}</label>)}</div></fieldset> : null;})}</div>}<button onClick={() => setModal(null)}>完成</button></Modal>}
    {modal === 'login' && <Modal title="登录" close={() => { if (!authBusy) setModal('account'); }}><div className="login-symbol" aria-hidden="true">拾</div><h3>本机测试账号</h3><p>用于体验登录和健康模式。无需填写真实个人资料，不连接正式账户服务。</p>{sessionInfo?.localTestFeatures ? <button className="primary login-submit" disabled={authBusy} onClick={() => void login()}>{authBusy ? '正在登录…' : '登录测试账号'}</button> : <p>当前服务未开启本机测试登录。</p>}{authMessage && <p role="alert">{authMessage}</p>}</Modal>}

    {detail && <Modal title={detail.recipe.name} close={() => setDetail(null)}><p className="detail-meta">{detail.variant.flavor}{detail.recipe.minutes !== null ? ` · ${detail.recipe.minutes} 分钟` : ''}</p>{detail.message && <p role="status" className="warning-box">{detail.message}</p>}<RecipePhoto recipe={detail.recipe} detail/>{detail.recipe.publicAttribution&&<p className="recipe-source">来源：{detail.recipe.publicAttribution.label}</p>}<h3>食材与用量</h3><ul className="detail-lines">{[...new Set(detail.variant.lines.map(l => `${recipeLineText(l,foodById)}${l.optional ? '（可选）' : ''}`))].map(text => <li key={text}>{text}</li>)}</ul><h3>{detail.variant.methodOptions?.length ? '选择一种做法' : '慢慢来，一步步做'}</h3><div className={`detail-method-grid${detail.variant.methodOptions?.length ? ' has-options' : ''}`}><section><h4>{detail.variant.methodLabel ? '做法一 · '+detail.variant.methodLabel : detail.variant.methodOptions?.length ? '做法一' : '做法'}</h4><ol className="steps">{detail.variant.steps.map(s => <li key={s}>{s}</li>)}</ol></section>{detail.variant.methodOptions?.map((method,index)=><section key={`${method.label}-${index}`}><h4>做法{index+2}{method.label ? ` · ${method.label}` : ''}</h4><ol className="steps">{method.steps.map((step,stepIndex)=><li key={`${stepIndex}-${step}`}>{step}</li>)}</ol></section>)}</div>{detail.nutrition && Object.values(detail.nutrition).some(n=>n!==null) && <div className="nutrition-box"><h3>营养参考</h3>{detail.nutrition.kcal!==null && <p>热量：{detail.nutrition.kcal} kcal</p>}{detail.nutrition.protein!==null && <p>蛋白质：{detail.nutrition.protein} g</p>}{detail.nutrition.sodium!==null && <p>钠：{detail.nutrition.sodium} mg</p>}<p className="small">标准配方整道菜的投料估算，仅供参考。</p></div>}<div className="detail-favorite-area"><FavoriteControl recipe={detail.recipe} variant={detail.variant} active={isFavorite(detail.recipe, detail.variant)} toggle={() => toggleFavorite(detail.recipe, detail.variant)}/><p className="favorite-feedback" role="status" aria-live="polite">{favoriteFeedback}</p></div></Modal>}
  </>;
}
function GalleryPage() {
  return <><SiteHeader page="recipes"/><main><CandidateLibrary/></main></>;
}
function Bootstrap() {
  const [catalog, setCatalog] = useState<ContentContext | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    setError('');
    try { const [snapshot]=await Promise.all([fetchCatalog(),initializeAccount()]);setAccountCatalog(snapshot);setCatalog(contentContext(snapshot)); }
    catch (error) { setError((error as Error).message); }
  };
  useEffect(() => { void load(); }, []);
  return catalog ? <><AccountBanner/>{location.pathname==='/recipes'?<GalleryPage/>:<App catalog={catalog} page={location.pathname === '/favorites' ? 'favorites' : 'workspace'}/>}</> : <main className="catalog-loading"><h1>拾味</h1><p role={error ? 'alert' : 'status'}>{error || '正在读取菜谱内容…'}</p>{error && <button onClick={() => void load()}>重新读取菜谱</button>}</main>;
}
createRoot(document.getElementById('root')!).render(<Bootstrap/>);
