import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readNutritionExpansion, searchNutritionKnowledge } from '../backend/src/rag/nutrition-knowledge';
import { connectLocalNutritionDatabase, persistNutritionExpansion, queryLocalNutritionKnowledge } from '../backend/src/rag/nutrition-knowledge-repository';
import { persistGuidanceAssets, readFoodGuidanceAssets } from '../backend/src/rag/food-guidance-repository';

async function main(){
  const [command,...args]=process.argv.slice(2);
  let query='',databaseFile='.local-data/rag/database-url',output='',conditions:Record<string,string>={};
  for(let i=0;i<args.length;i++){
    const value=args[i+1];if(!value)throw Error('NUTRITION_ARGUMENT_INVALID');
    if(args[i]==='--query')query=value;
    else if(args[i]==='--database-url-file')databaseFile=value;
    else if(args[i]==='--output')output=value;
    else if(args[i]==='--conditions'){const parsed=JSON.parse(value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.values(parsed).some(v=>typeof v!=='string'))throw Error('NUTRITION_CONDITIONS_INVALID');conditions=parsed;}
    else throw Error('NUTRITION_ARGUMENT_INVALID');i++;
  }
  if(!['verify','query','import-local','query-local'].includes(command??'')||(['query','query-local'].includes(command)&&!query)||(['verify','import-local'].includes(command)&&query))throw Error('NUTRITION_COMMAND_INVALID');
  if(!command.endsWith('local')&&databaseFile!=='.local-data/rag/database-url')throw Error('NUTRITION_DATABASE_ARGUMENT_REQUIRES_LOCAL_COMMAND');
  // Persist only import/verification reports. Public corpus never stores personal query text or conditions.
  if(output&&['query','query-local'].includes(command))throw Error('NUTRITION_QUERY_PERSISTENCE_DISABLED');
  const {bundle,manifest}=await readNutritionExpansion();let result:unknown;
  if(command==='verify')result={id:bundle.id,counts:manifest.counts,integrity:'passed',clinicalRelease:null,newEmbeddingBuilt:false};
  else if(command==='query')result=searchNutritionKnowledge(bundle,query,{conditions});
  else{
    const db=await connectLocalNutritionDatabase(databaseFile);
    try{
      if(command==='import-local'){
        // Current base, goals and mapping remain versioned, including cross-version revocations.
        await persistGuidanceAssets(db,await readFoodGuidanceAssets());
        const second=await persistNutritionExpansion(db,bundle);
        result={id:bundle.id,counts:manifest.counts,localPostgres:true,importedAndReadBack:true,idempotentSecondImport:!second.imported,hash:second.hash,clinicalRelease:null,newEmbeddingBuilt:false,realPaidCalls:0};
      }else result=await queryLocalNutritionKnowledge(db,query,{conditions});
    }finally{await db.close();}
  }
  if(output){await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{console.error(error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:'NUTRITION_OPERATION_FAILED_CREDENTIALS_OMITTED');process.exitCode=1;});
