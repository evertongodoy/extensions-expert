async function inflateRaw(bytes){
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function u16(d,o){return d[o]|(d[o+1]<<8)}
function u32(d,o){return (d[o]|(d[o+1]<<8)|(d[o+2]<<16)|(d[o+3]<<24))>>>0}
async function unzipEntry(buffer,target){
  const d=new Uint8Array(buffer); let eocd=-1;
  for(let i=d.length-22;i>=Math.max(0,d.length-65557);i--){if(u32(d,i)===0x06054b50){eocd=i;break}}
  if(eocd<0) throw new Error('DOCX inválido: diretório ZIP não encontrado.');
  const count=u16(d,eocd+10), cd=u32(d,eocd+16); let p=cd;
  for(let n=0;n<count;n++){
    if(u32(d,p)!==0x02014b50) break;
    const method=u16(d,p+10), csize=u32(d,p+20), nlen=u16(d,p+28), xlen=u16(d,p+30), clen=u16(d,p+32), loff=u32(d,p+42);
    const name=new TextDecoder().decode(d.slice(p+46,p+46+nlen));
    if(name===target){
      if(u32(d,loff)!==0x04034b50) throw new Error('DOCX inválido: entrada XML corrompida.');
      const ln=u16(d,loff+26), lx=u16(d,loff+28), start=loff+30+ln+lx, comp=d.slice(start,start+csize);
      if(method===0) return comp;
      if(method===8) return inflateRaw(comp);
      throw new Error('Método de compactação DOCX não suportado: '+method);
    }
    p+=46+nlen+xlen+clen;
  }
  throw new Error('Não encontrei word/document.xml no DOCX.');
}
function xmlToLines(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('Não foi possível interpretar o XML do DOCX.');
  return [...doc.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('').trim()).filter(Boolean);
}
function parseQuestions(lines){
  const out=[];

  // Word pode salvar pergunta + A/B/C/D no MESMO parágrafo.
  // Por isso, primeiro juntamos o texto e localizamos blocos pelo padrão
  // "n. pergunta A) ... B) ... C) ... D) ...".
  const text=lines.join('\n').replace(/\u00a0/g,' ').replace(/\r/g,'');
  const starts=[...text.matchAll(/(?:^|\n)(\d+)\s*[.)-]\s*/gm)];

  for(let i=0;i<starts.length;i++){
    const m=starts[i];
    const from=m.index + m[0].length;
    const to=i+1<starts.length ? starts[i+1].index : text.length;
    let block=text.slice(from,to).trim();

    // O DOCX fornecido concatena A), B), C) e D) ao texto da pergunta.
    // Ex.: "Qual...?A) ...B) ...C) ...D) ..."
    const marks=[...block.matchAll(/([ABCD])\s*[).:-]\s*/g)];
    if(marks.length<4) continue;

    const firstA=marks.find(x=>x[1].toUpperCase()==='A');
    if(!firstA) continue;
    const question=block.slice(0,firstA.index).trim();
    const answers=Array(4); let correct=null;

    for(let j=0;j<marks.length;j++){
      const mark=marks[j];
      const letter=mark[1].toUpperCase();
      const idx='ABCD'.indexOf(letter);
      if(idx<0) continue;
      const aStart=mark.index+mark[0].length;
      const aEnd=j+1<marks.length ? marks[j+1].index : block.length;
      let answer=block.slice(aStart,aEnd).trim();
      if(answer.includes('✅')) correct=idx;
      answer=answer.replace(/✅/g,'').trim();
      answers[idx]=answer;
    }

    if(question && answers.every(Boolean) && Number.isInteger(correct)){
      out.push({number:+m[1],question,answers,correct});
    }
  }

  if(!out.length){
    throw new Error('Nenhuma questão encontrada no DOCX. O leitor aceita pergunta e alternativas em linhas separadas ou no mesmo parágrafo.');
  }
  return out;
}

async function readDocxQuestions(file){
  if(!/\.docx$/i.test(file.name)) throw new Error('Selecione um arquivo .docx.');
  const bytes=await unzipEntry(await file.arrayBuffer(),'word/document.xml');
  const xml=new TextDecoder('utf-8').decode(bytes);
  return parseQuestions(xmlToLines(xml));
}
