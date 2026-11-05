import React from 'react';

// A deliberately small Markdown renderer: React escapes every text node. No HTML,
// remote images or executable links from model output are accepted.
function inline(text:string):React.ReactNode[]{
  const parts:React.ReactNode[]=[];
  const pattern=/(\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+`|\[[^\]]+\]\([^)]*\))/g;
  let at=0;for(const match of text.matchAll(pattern)){
    if(match.index!>at)parts.push(text.slice(at,match.index));
    const value=match[0];
    if(value.startsWith('**')||value.startsWith('__'))parts.push(<strong key={match.index}>{value.slice(2,-2).trim()}</strong>);
    else if(value.startsWith('`'))parts.push(<code key={match.index}>{value.slice(1,-1)}</code>);
    else parts.push(value.slice(1,value.indexOf(']')));
    at=match.index!+value.length;
  }
  if(at<text.length)parts.push(text.slice(at));return parts;
}
export function ChatMarkdown({text}:{text:string}){
  const lines=text.replace(/\r\n?/g,'\n').split('\n'),blocks:React.ReactNode[]=[];
  for(let i=0;i<lines.length;){
    const line=lines[i].trim();if(!line){i++;continue;}
    const normalized=line.replace(/^\*\*\s*(\d+[.)、].*?)\s*\*\*$/,'$1');
    const item=normalized.match(/^(?:([-*+•])\s+|(\d+)[.)、]\s*)(.*)$/);
    if(item){
      const ordered=Boolean(item[2]),items:React.ReactNode[]=[];const start=Number(item[2]??1),key=i;
      while(i<lines.length){const entry=lines[i].trim().replace(/^\*\*\s*(\d+[.)、].*?)\s*\*\*$/,'$1').match(/^(?:([-*+•])\s+|(\d+)[.)、]\s*)(.*)$/);if(!entry||Boolean(entry[2])!==ordered)break;items.push(<li key={i}>{inline(entry[3])}</li>);i++;}
      blocks.push(ordered?<ol key={key} start={start}>{items}</ol>:<ul key={key}>{items}</ul>);continue;
    }
    if(/^#{1,6}\s+/.test(line)){blocks.push(<h4 key={i}>{inline(line.replace(/^#{1,6}\s+/,''))}</h4>);i++;continue;}
    const paragraph:string[]=[];const key=i;
    while(i<lines.length&&lines[i].trim()&&!/^(?:#{1,6}\s|[-*+•]\s|\d+[.)、]\s|\*\*\s*\d+[.)、])/.test(lines[i].trim()))paragraph.push(lines[i++]);
    if(!paragraph.length)paragraph.push(lines[i++]);
    blocks.push(<p key={key}>{paragraph.map((value,j)=><React.Fragment key={j}>{j>0&&<br/>}{inline(value)}</React.Fragment>)}</p>);
  }
  return <div className="chat-rich-text">{blocks}</div>;
}
