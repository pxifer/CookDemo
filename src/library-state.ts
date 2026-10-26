export interface LibraryState {
  query:string;ingredient:string;method:string;flavor:string;category:string;page:number;selected:string|null;variant:string;
}
const clean=(value:string|null,max=100)=>(value??'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
export function readLibraryState(search:string):LibraryState{
  const p=new URLSearchParams(search),rawPage=p.get('page')??'1';
  return {query:clean(p.get('q'),80),ingredient:clean(p.get('ingredient')),method:clean(p.get('method')),flavor:clean(p.get('flavor')),
    category:clean(p.get('category')),page:/^\d{1,4}$/.test(rawPage)?Math.max(0,Math.min(999,Number(rawPage)-1)):0,
    selected:clean(p.get('dish'),150)||null,variant:clean(p.get('taste'))};
}
export function libraryUrl(state:LibraryState):string{
  const p=new URLSearchParams();
  for(const [key,value] of Object.entries({q:state.query,ingredient:state.ingredient,method:state.method,flavor:state.flavor,category:state.category,dish:state.selected,taste:state.selected?state.variant:''}))if(value)p.set(key,value);
  if(state.page>0)p.set('page',String(Math.min(999,Math.floor(state.page))+1));
  return '/recipes'+(p.size?'?'+p.toString():'');
}
