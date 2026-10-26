import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { libraryUrl, readLibraryState, type LibraryState } from './library-state';
import { DishImage } from './recipe-photo';
import { requiredIngredientText } from '../shared/recipe-ingredients';
import { fetchCatalog } from './api';
import { galleryFavoriteKey, readFavorites, readGalleryFavorites, writeGalleryFavorites, writeValue } from './storage';

type CandidateRow = {
  dish_key: string; flavor: string; image_url: string | null;
  publicAttribution?: {label:string;url:string};
  raw_record: { id?: string; category?: string; main?: string[]; aux?: string[]; seasonings?: string[]; steps?: string[]; main_method_label?:string; method_options?:{label:string;steps:string[]}[] };
};
type Response = { count: number; recipes: CandidateRow[]; recommendationAvailable?: boolean };
const categories: Record<string,string> = {meat:'荤菜',veg:'素菜',soup:'汤品'};
const ingredientGroups: [string,RegExp][] = [
  ['鸡肉',/鸡(?!蛋|精|粉)/],['猪肉',/猪|五花|里脊|排骨|肉馅|肘子/],['牛羊肉',/牛肉|牛腩|肥牛|牛里脊|牛排|羊肉|羊排/],
  ['鱼类',/鱼/],['虾蟹贝类',/虾|蟹|蛤|蛏|贝|蚝|鱿/],['蛋类',/蛋/],['豆制品',/豆腐|豆干|腐竹/],
  ['叶菜',/白菜|菜心|菠菜|包菜|娃娃菜|生菜|空心菜|油麦菜|芹菜|韭菜/],
  ['根茎瓜果',/土豆|萝卜|茄子|番茄|西红柿|冬瓜|南瓜|黄瓜|莲藕|笋|山药/],['菌菇',/菇|木耳|菌/],
];
const methods: [string,RegExp][] = [['凉拌',/凉拌|凉菜|拍黄瓜/],['蒸',/蒸|桑拿/],['烤',/烤/],['炖',/炖/],['焖',/焖/],['煎',/煎/],['炸',/炸|酥/],['炒',/炒|干锅|干煸|爆/],['卤',/卤/],['烧',/烧|茄汁|糖醋/],['煮／汤羹',/煮|汤|羹|白灼/]];
function traits(row: CandidateRow) {
  const main=requiredIngredientText([...(row.raw_record.main??[]),...(row.raw_record.aux??[])]);
  const method=methods.find(([,r])=>r.test(row.dish_key))?.[0] ?? methods.find(([,r])=>r.test((row.raw_record.steps??[]).join(' ')))?.[0] ?? '其他';
  return {ingredients:ingredientGroups.filter(([,r])=>r.test(main)).map(([n])=>n),method,category:categories[row.raw_record.category??'']??'其他'};
}

export function CandidateLibrary() {
  const [data,setData]=useState<Response|null>(null), [error,setError]=useState('');
  const [routeNotice,setRouteNotice]=useState('');
  const [pendingFavoriteKeys,setPendingFavoriteKeys]=useState<Set<string>>(()=>new Set());
  const pendingFavoriteKeysRef=useRef(new Set<string>());
  const catalogPromise=useRef<ReturnType<typeof fetchCatalog>|null>(null);
  const [favoriteKeys,setFavoriteKeys]=useState<string[]>(readGalleryFavorites);
  useEffect(()=>{const applied=()=>setFavoriteKeys(readGalleryFavorites());window.addEventListener('shiwei:account-applied',applied);return()=>window.removeEventListener('shiwei:account-applied',applied);},[]);
  const saveFavorite=async(name:string,flavor:string)=>{
    const key=galleryFavoriteKey(name,flavor);
    if(pendingFavoriteKeysRef.current.has(key))return;
    const sidecar=readGalleryFavorites(),active=sidecar.includes(key);
    if(!active&&sidecar.length>=100){setRouteNotice('收藏已达100项，请先移除不需要的收藏。');return;}
    const optimistic=active?sidecar.filter(v=>v!==key):[...sidecar,key];
    if(!writeGalleryFavorites(optimistic)){setRouteNotice('浏览器未允许保存收藏，请检查存储设置。');return;}
    setFavoriteKeys(optimistic);
    pendingFavoriteKeysRef.current.add(key);
    setPendingFavoriteKeys(new Set(pendingFavoriteKeysRef.current));
    setRouteNotice(active?`正在取消收藏：${name} · ${flavor}。`:`已收藏：${name} · ${flavor}，正在同步到我的收藏。`);
    try {
      catalogPromise.current??=fetchCatalog().catch(error=>{catalogPromise.current=null;throw error;});
      const catalog=await catalogPromise.current,recipe=catalog.recipes.find(r=>r.name===name),variant=recipe?.variants.find(v=>v.flavor===flavor);
      if(!recipe||!variant)throw Error('这份口味尚未接入当前工作台，请稍后再试。');
      const saved=readFavorites();
      const favoriteExists=saved.some(f=>f.recipeId===recipe.id&&f.variantId===variant.id);
      const nextSaved=active?saved.filter(f=>f.recipeId!==recipe.id||f.variantId!==variant.id):favoriteExists?saved:[...saved,{recipeId:recipe.id,variantId:variant.id}];
      if(!active&&!favoriteExists&&saved.length>=100)throw Error('收藏已达100项，请先移除不需要的收藏。');
      if(!writeValue('shiwei:guest:favorites:v1',nextSaved))throw Error('浏览器未允许保存收藏，请检查存储设置。');
      setRouteNotice(active?`已取消收藏：${name} · ${flavor}。`:`已收藏：${name} · ${flavor}，可在「我的收藏」查看。`);
    }catch(error){
      const current=readGalleryFavorites(),rolledBack=active?[...current,key].slice(0,100):current.filter(v=>v!==key);
      writeGalleryFavorites(rolledBack);setFavoriteKeys(rolledBack);setRouteNotice((error as Error).message);
    }finally{
      pendingFavoriteKeysRef.current.delete(key);setPendingFavoriteKeys(new Set(pendingFavoriteKeysRef.current));
    }
  };
  const [route,setRoute]=useState(()=>readLibraryState(location.search));
  const routeRef=useRef(route);routeRef.current=route;
  const summary=useRef<HTMLParagraphElement>(null);
  const detailHeading=useRef<HTMLHeadingElement>(null),grid=useRef<HTMLDivElement>(null);
  const previousDish=useRef<string|null>(null);
  const pagePositionPending=useRef(false);
  const {query,ingredient,method,flavor,category,page,selected,variant}=route;
  const change=(patch:Partial<LibraryState>,replace=false)=>{
    const next={...routeRef.current,...patch};routeRef.current=next;
    history[replace?'replaceState':'pushState'](replace?history.state:{},'',libraryUrl(next));setRoute(next);
  };
  const setQuery=(query:string)=>change({query,page:0},true),setIngredient=(ingredient:string)=>change({ingredient,page:0}),
    setMethod=(method:string)=>change({method,page:0}),setFlavor=(flavor:string)=>change({flavor,page:0}),setCategory=(category:string)=>change({category,page:0});
  useEffect(()=>{document.title=selected?`${selected} · 菜谱图鉴｜拾味`:'菜谱图鉴｜拾味';},[selected]);
  useEffect(()=>{
    const restoration=history.scrollRestoration;
    history.scrollRestoration='manual';
    const c=new AbortController();
    void fetch('/api/v1/local/candidate-recipes',{signal:AbortSignal.any([c.signal,AbortSignal.timeout(8000)])}).then(async r=>{if(!r.ok)throw new Error();const result=await r.json() as Response;if(!Array.isArray(result.recipes))throw new Error();return result;}).then(setData).catch(()=>{if(!c.signal.aborted)setError('图鉴暂时读取失败，请重试；已有筛选仍保留。');});
    const back=()=>{const next=readLibraryState(location.search);if(!next.selected&&!routeRef.current.selected&&next.page!==routeRef.current.page)pagePositionPending.current=true;routeRef.current=next;setRoute(next);}; window.addEventListener('popstate',back);
    return()=>{c.abort();window.removeEventListener('popstate',back);history.scrollRestoration=restoration;};
  },[]);
  const rows=useMemo(()=>(data?.recipes??[]).map(row=>({...row,traits:traits(row)})),[data]);
  const options={ingredients:[...new Set(rows.flatMap(r=>r.traits.ingredients))],methods:[...new Set(rows.map(r=>r.traits.method))],flavors:[...new Set(rows.map(r=>r.flavor))],categories:[...new Set(rows.map(r=>r.traits.category))]};
  useEffect(()=>{
    if(!data)return;
    const patch:Partial<LibraryState>={};
    if(ingredient&&!options.ingredients.includes(ingredient))patch.ingredient='';
    if(method&&!options.methods.includes(method))patch.method='';
    if(flavor&&!options.flavors.includes(flavor))patch.flavor='';
    if(category&&!options.categories.includes(category))patch.category='';
    if(Object.keys(patch).length){setRouteNotice('部分筛选条件已失效，已清除；其他条件已保留。');change({...patch,page:0},true);}
  },[data,ingredient,method,flavor,category]);
  const dishes=useMemo(()=>{
    const groups=new Map<string,CandidateRow[]>(); const q=query.trim();
    for(const row of rows){
      if((q&&!row.dish_key.includes(q))||(ingredient&&!row.traits.ingredients.includes(ingredient))||(method&&row.traits.method!==method)||(flavor&&row.flavor!==flavor)||(category&&row.traits.category!==category))continue;
      groups.set(row.dish_key,[...(groups.get(row.dish_key)??[]),row]);
    }
    return [...groups].map(([name,variants])=>{
      const distinct=variants.filter((row,index)=>variants.findIndex(v=>v.flavor===row.flavor)===index);
      return {name,variants:distinct,photo:distinct.find(v=>v.image_url)??distinct[0]};
    });
  },[rows,query,ingredient,method,flavor,category]);
  const lastPage=Math.max(0,Math.ceil(dishes.length/24)-1);
  useEffect(()=>{if(data&&page>lastPage)change({page:lastPage},true);},[data,page,lastPage]);
  const open=(name:string|null,selectedFlavor?:string)=>{
    if(name===null&&history.state?.libraryReturn){history.back();return;}
    if(name&&!selected){
      history.replaceState({...history.state,libraryScrollY:window.scrollY},'',location.href);
    }
    const matchedFlavor=name?selectedFlavor??dishes.find(d=>d.name===name)?.variants[0]?.flavor??'':'';
    change({selected:name,variant:matchedFlavor},name===null);
    if(name)history.replaceState({...history.state,libraryReturn:true},'',location.href);
  };
  const goPage=(page:number)=>{pagePositionPending.current=true;change({page});};
  const favoriteButton=(name:string,flavor:string)=>{
    const key=galleryFavoriteKey(name,flavor),active=favoriteKeys.includes(key);
    return <button type="button" disabled={pendingFavoriteKeys.has(key)} aria-pressed={active} aria-label={`${active?'取消收藏':'收藏'} ${name}`} onClick={()=>void saveFavorite(name,flavor)}>{active?'已收藏 ♥':'收藏 ♡'}</button>;
  };
  const allVariants=rows.filter(r=>r.dish_key===selected);
  const variants=allVariants.filter((r,i)=>allVariants.findIndex(v=>v.flavor===r.flavor)===i);
  const detail=variants.find(r=>r.flavor===variant)??variants[0];
  const references=detail?allVariants.filter(r=>r.flavor===detail.flavor&&r.raw_record.id!==detail.raw_record.id):[];
  useLayoutEffect(()=>{
    if(!data)return;
    if(selected){previousDish.current=selected;window.scrollTo({top:0,behavior:'instant'});detailHeading.current?.focus({preventScroll:true});}
    else if(previousDish.current){
      const card=[...(grid.current?.querySelectorAll<HTMLButtonElement>('button[data-dish]')??[])].find(b=>b.dataset.dish===previousDish.current);
      (card??summary.current)?.focus({preventScroll:true});previousDish.current=null;
      window.scrollTo({top:history.state?.libraryScrollY??0,behavior:'instant'});
    }
    else if(pagePositionPending.current){
      pagePositionPending.current=false;summary.current?.focus({preventScroll:true});
      if(grid.current)window.scrollTo({top:window.scrollY+grid.current.getBoundingClientRect().top-16,behavior:'instant'});
    }
  },[selected,data,page]);
  const filter=(label:string,value:string,values:string[],change:(v:string)=>void)=><label className="library-filter">{label}<select aria-label={`按${label}筛选`} value={value} onChange={e=>change(e.target.value)}><option value="">全部{label}</option>{values.map(v=><option key={v}>{v}</option>)}</select></label>;
  return <section className="candidate-library library-page" aria-label="菜谱图鉴">
    <div className="candidate-library-head"><div><span className="eyebrow">SHIWEI RECIPE COLLECTION</span><h1>菜谱图鉴</h1><p>从手边食材，到喜欢的那一味。</p></div><a className="library-home" href="/">返回做饭工作台 ↗</a></div>
    <p role="status" aria-live="polite" className="library-review-note library-route-status">{routeNotice}</p>
    {error&&<p className="candidate-state" role="alert">{error}<button onClick={()=>location.reload()}>重新读取</button></p>}
    {!data&&!error&&<p className="candidate-state" role="status">正在读取菜谱…</p>}
    {selected&&detail?<article className="library-recipe-detail">
      <button className="library-back" onClick={()=>open(null)}>← 返回菜谱图鉴</button>
      <div className="library-recipe-heading"><h2 ref={detailHeading} tabIndex={-1}>{detail.dish_key}</h2>{variants.length>1?<label>单菜口味<select aria-label={`${detail.dish_key}口味`} value={detail.flavor} onChange={e=>change({variant:e.target.value},true)}>{variants.map(v=><option key={v.flavor} value={v.flavor}>{v.flavor}</option>)}</select></label>:<span className="library-flavor">{detail.flavor}</span>}</div>
      {detail.publicAttribution&&<p className="recipe-source">来源：{detail.publicAttribution.label}</p>}
      {data?.recommendationAvailable&&<button className="library-save" type="button" disabled={pendingFavoriteKeys.has(galleryFavoriteKey(detail.dish_key,detail.flavor))} aria-pressed={favoriteKeys.includes(galleryFavoriteKey(detail.dish_key,detail.flavor))} onClick={()=>void saveFavorite(detail.dish_key,detail.flavor)}>{favoriteKeys.includes(galleryFavoriteKey(detail.dish_key,detail.flavor))?'已收藏 · 点击取消 ♥':'收藏此口味 ♡'}</button>}
      {detail.image_url&&<DishImage name={detail.dish_key} src={detail.image_url} className="candidate-detail-image" fallback={<p className="candidate-state">这道菜的配图暂不可用，食材和步骤仍可查看。</p>}/>}
      <div className="library-recipe-columns"><section><h3>食材</h3><h4>主料</h4><ul>{(detail.raw_record.main??[]).map((s,i)=><li key={i}>{s}</li>)}</ul>{!!detail.raw_record.aux?.length&&<><h4>辅料</h4><ul>{detail.raw_record.aux.map((s,i)=><li key={i}>{s}</li>)}</ul></>}{!!detail.raw_record.seasonings?.length&&<><h4>调料</h4><ul>{detail.raw_record.seasonings.map((s,i)=><li key={i}>{s}</li>)}</ul></>}</section><section><h3>{detail.raw_record.main_method_label?`做法一 · ${detail.raw_record.main_method_label}`:detail.raw_record.steps?.length?'一步步做':'选择下方做法参考'}</h3><ol className="steps">{(detail.raw_record.steps??[]).map((s,i)=><li key={i}>{s}</li>)}</ol></section></div>
      {!!detail.raw_record.method_options?.length&&<section className="library-method-references" aria-label="另一种做法"><h3>另一种做法</h3><div className="library-method-options">{detail.raw_record.method_options.map((method,i)=><details key={method.label} open={i===0}><summary>做法{i+2}{method.label?` · ${method.label}`:''}</summary><ol className="steps">{method.steps.map((s,n)=><li key={n}>{s}</li>)}</ol></details>)}</div></section>}
      {!!references.length&&<details className="library-method-references"><summary>其他做法（{references.length}）</summary>{references.map((r,i)=><section key={r.raw_record.id??i}><h3>做法 {i+2}</h3><p>{[...(r.raw_record.main??[]),...(r.raw_record.aux??[]),...(r.raw_record.seasonings??[])].join('、')}</p><ol>{(r.raw_record.steps??[]).map((s,n)=><li key={n}>{s}</li>)}</ol></section>)}</details>}
      <div className="library-detail-footer"><button className="library-back" onClick={()=>open(null)}>返回菜谱图鉴 →</button></div>
    </article>:data&&selected?<div className="candidate-state" role="status"><h2>没有找到这道菜谱</h2><p>这道菜可能已调整或暂不可用，可以返回图鉴继续查找。</p><button onClick={()=>open(null)}>返回菜谱图鉴</button></div>:<>
      <label className="library-search">搜索菜名<input type="search" maxLength={80} value={query} onChange={e=>setQuery(e.target.value)} placeholder="想做哪道菜？"/></label>
      <div className="library-filters">{filter('食材',ingredient,options.ingredients,setIngredient)}{filter('做法',method,options.methods,setMethod)}{filter('口味',flavor,options.flavors,setFlavor)}{filter('菜品类型',category,options.categories,setCategory)}</div>
      {(query||ingredient||method||flavor||category)&&<button className="library-reset" onClick={()=>change({query:'',ingredient:'',method:'',flavor:'',category:'',page:0})}>清除筛选</button>}
      {data&&<p className="candidate-library-count" ref={summary} tabIndex={-1} role="status">{dishes.length} 道菜 · {dishes.reduce((n,d)=>n+new Set(d.variants.map(v=>v.flavor)).size,0)} 种口味做法</p>}
      {data&&!dishes.length&&<p className="candidate-state" role="status">没有符合筛选条件的菜谱，可以减少筛选条件再看看。</p>}
      <div className="candidate-grid" ref={grid}>{dishes.slice(page*24,page*24+24).map(item=><article className="candidate-card" key={item.name}>
        <button className="candidate-photo" data-dish={item.name} onClick={()=>open(item.name)} aria-label={`查看${item.name}做法`}><DishImage name={item.name} src={item.photo.image_url} fallback={<span className="candidate-no-photo"><i>SHIWEI KITCHEN</i><b>{item.name}</b></span>}/></button>
        <div className="candidate-card-body"><h2>{item.name}</h2>{item.variants.length>1?<label className="candidate-flavor-select">单菜口味<select aria-label={`${item.name}口味`} value={item.variants[0].flavor} onChange={e=>open(item.name,e.target.value)}>{item.variants.map(v=><option key={v.flavor} value={v.flavor}>{v.flavor}</option>)}</select></label>:<div className="candidate-flavors"><span>{item.variants[0].flavor}</span></div>}<div className="candidate-card-actions"><button onClick={()=>open(item.name)}>查看做法 ↗</button>{data?.recommendationAvailable&&favoriteButton(item.name,item.variants[0].flavor)}</div></div>
      </article>)}</div>
      {dishes.length>24&&<nav className="library-pagination" aria-label="图鉴分页"><button disabled={!page} onClick={()=>goPage(page-1)}>上一页</button><span>{page+1} / {Math.ceil(dishes.length/24)}</span><button disabled={(page+1)*24>=dishes.length} onClick={()=>goPage(page+1)}>下一页</button></nav>}
    </>}
  </section>;
}


